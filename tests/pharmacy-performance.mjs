import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { startPharmacyServer } from '../tools/pharmacy-server.mjs';

const baseline = process.argv.includes('--baseline');
const output = path.resolve('test-results', baseline ? 'phase3-baseline.json' : 'phase3-performance.json');
const server = await startPharmacyServer();
let browser;
const results = [];
const baselineWorld = baseline ? execFileSync('git', ['show', 'ac9a835:public/pharmacy/world.js'], { encoding: 'utf8' }) : null;
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [device, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', ...(device === 'mobile' ? { isMobile: true, hasTouch: true } : {}) });
    await context.addInitScript(() => {
      window.perfCounts = { frames: 0, calls: 0, labels: 0, callbacks: 0 };
      const raf = window.requestAnimationFrame;
      window.requestAnimationFrame = callback => raf(time => {
        window.perfCounts.callbacks++;
        const before = window.perfCounts.calls; callback(time);
        if (window.perfCounts.calls > before) window.perfCounts.frames++;
      });
      for (const method of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const original = WebGL2RenderingContext.prototype[method];
        WebGL2RenderingContext.prototype[method] = function (...args) { window.perfCounts.calls++; return original.apply(this, args); };
      }
      const attr = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function (name, value) {
        if (this.tagName === 'line' && this.closest('.map-links')) window.perfCounts.labels++;
        return attr.call(this, name, value);
      };
    });
    const page = await context.newPage(), errors = [];
    if (baseline) await page.route('**/pharmacy/world.js', route => route.fulfill({ contentType: 'text/javascript', body: baselineWorld }));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.base + '/pharmacy/');
    await page.waitForSelector('html[data-world="ready"]');
    const sample = async (state, ms = 650) => {
      const before = await page.evaluate(() => ({ ...window.perfCounts, time: performance.now() }));
      await page.waitForTimeout(ms);
      const after = await page.evaluate(() => ({ ...window.perfCounts, time: performance.now() }));
      const row = { device, state, milliseconds: Math.round(after.time - before.time), frames: after.frames - before.frames, callbacks: after.callbacks - before.callbacks, drawCalls: after.calls - before.calls, labelWrites: after.labels - before.labels };
      results.push(row); return row;
    };
    const idle = async state => {
      if (baseline) await page.waitForTimeout(1500);
      else {
        await page.evaluate(() => { window.perfQuiet = { calls: -1, since: performance.now() }; });
        await page.waitForFunction(() => {
          const quiet = window.perfQuiet, now = performance.now();
          if (quiet.calls !== window.perfCounts.calls) { quiet.calls = window.perfCounts.calls; quiet.since = now; }
          return now - quiet.since >= 350;
        }, null, { polling: 100, timeout: 12000 });
      }
      const row = await sample(state);
      if (!baseline) assert.equal(row.drawCalls + row.labelWrites, 0, `${device} ${state}: settled world must stop rendering and label writes`);
      if (!baseline) assert.equal(row.callbacks, 0, `${device} ${state}: no idle RAF loop`);
    };
    await idle('overview-idle');
    await page.locator('#world [data-category="clinical"]').click();
    await page.waitForSelector('#world[data-travel="arrived"]');
    await idle('category-idle');
    await page.locator('#world [data-tool="vanco-auc-calc"]').click();
    await page.waitForSelector('#detail:not([hidden])');
    await idle('tool-idle');
    await page.locator('#overview').click();
    await page.waitForTimeout(300);
    const canvas = page.locator('#world canvas');
    const rect = await canvas.boundingBox();
    await page.mouse.move(rect.x + rect.width * .7, rect.y + rect.height * .4);
    const beforeDrag = await page.locator('.map-links line').evaluateAll(nodes => nodes.map(n => n.getAttribute('x1')).join(','));
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * .6, rect.y + rect.height * .45, { steps: 6 });
    await page.mouse.up();
    const drag = await sample('orbit-damping');
    assert(drag.drawCalls > 0, `${device}: OrbitControls must wake rendering`);
    const afterDrag = await page.locator('.map-links line').evaluateAll(nodes => nodes.map(n => n.getAttribute('x1')).join(','));
    assert.notEqual(beforeDrag, afterDrag, 'orbit updates projected anchors');
    await idle('orbit-settled');
    await page.locator('#overview').click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#world [data-category="gov"]').click();
    await page.waitForSelector('#world[data-travel="moving"]');
    const walk = await sample('walking'); assert(walk.drawCalls > 0 && walk.labelWrites > 0);
    await page.locator('#world [data-category="ebm"]').click();
    assert.equal(await page.locator('#world').getAttribute('data-destination'), 'ebm');
    const retarget = await sample('retarget'); assert(retarget.drawCalls > 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForSelector('#world[data-travel="arrived"][data-destination="ebm"]');
    await idle('arrival-idle');
    await page.setViewportSize({ width: viewport.width - 20, height: viewport.height - 30 });
    const resize = await sample('resize'); assert(resize.drawCalls > 0 && resize.labelWrites > 0);
    await idle('resize-settled');
    assert.deepEqual(errors, []);
    await context.close();
  }
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ baseline, renderer: 'Chrome ANGLE/SwiftShader; counters are not hardware FPS', results }, null, 2));
  console.log(JSON.stringify(results));
  console.log(`PASS Phase 3 ${baseline ? 'baseline' : 'on-demand rendering'}: ${output}`);
} finally { await browser?.close(); await server.close(); }
