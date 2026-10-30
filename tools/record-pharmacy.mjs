import path from 'node:path';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { startPharmacyServer } from './pharmacy-server.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve('test-results/playwright-runtime');
const { chromium } = await import('playwright');
const { registry } = await import('../node_modules/playwright-core/lib/server/registry/index.js');
const ffmpeg = registry.findExecutable('ffmpeg').executablePath();
const run = promisify(execFile), output = path.resolve(process.argv[2] || 'test-results/r5-recording-01');
await mkdir(output); // new batch only; refuse to overwrite earlier recordings
const preview = await startPharmacyServer();
let browser;
const manifest = { validation: 'pending', audio: false, cases: ['normal-arrival', 'retarget-during-walk', 'rapid-last-destination'], videos: [] };
async function verifyVideo(file, name, viewport) {
  let probe = '';
  try { await run(ffmpeg, ['-hide_banner', '-i', file]); } catch (error) { probe = error.stderr || ''; }
  const duration = probe.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  const video = probe.match(/Video: ([^,]+),[^\n]*? (\d+)x(\d+)[^\n]*? ([\d.]+) fps/);
  assert(duration && video, 'recording must have readable duration/codec/size/fps');
  const seconds = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
  assert(seconds > 5 && Number(video[2]) === viewport.width && Number(video[3]) === viewport.height);
  const decodedBytes = await new Promise((resolve, reject) => {
    const process = spawn(ffmpeg, ['-v', 'error', '-xerror', '-i', file, '-c:v', 'png', '-compression_level', '0', '-f', 'image2', '-update', '1', 'pipe:1']);
    let bytes = 0, errors = '';
    process.stdout.on('data', chunk => { bytes += chunk.length; });
    process.stderr.on('data', chunk => { errors = (errors + chunk).slice(-4000); });
    process.on('error', reject);
    process.on('exit', code => code === 0 && bytes > 1024 ? resolve(bytes) : reject(new Error(`Video decode failed: ${errors}`)));
  });
  for (const [label, at] of [['start', Math.min(2, seconds / 4)], ['middle', seconds / 2], ['end', Math.max(0, seconds - 1)]]) {
    await run(ffmpeg, ['-v', 'error', '-n', '-ss', String(at), '-i', file, '-frames:v', '1', '-c:v', 'png', '-f', 'image2', path.join(output, `${name}-${label}.png`)]);
  }
  return { file: path.basename(file), width: Number(video[2]), height: Number(video[3]), fps: Number(video[4]), codec: video[1], durationSeconds: seconds, fullDecode: true, decodedBytes };
}
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, recordVideo: { dir: path.join(output, name), size: viewport }, reducedMotion: 'no-preference',
      ...(name === 'mobile' ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}) });
    const page = await context.newPage(), errors = [], timeline = [], started = Date.now();
    page.setDefaultTimeout(60000);
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.demoEvents = []; window.demoCsp = [];
      document.addEventListener('securitypolicyviolation', event => window.demoCsp.push(event.violatedDirective));
      document.addEventListener('DOMContentLoaded', () => {
        const world = document.querySelector('#world');
        new MutationObserver(() => window.demoEvents.push({ time: performance.now(), travel: world.dataset.travel, destination: world.dataset.destination }))
          .observe(world, { attributes: true, attributeFilter: ['data-travel', 'data-destination'] });
      });
    });
    const click = async selector => name === 'mobile' ? page.locator(selector).tap() : page.locator(selector).click();
    const zone = id => `#world .zone-label[data-category="${id}"]`;
    const event = label => timeline.push({ label, seconds: (Date.now() - started) / 1000 });
    const arrived = async id => {
      await page.waitForFunction(id => { const w = document.querySelector('#world'); return w.dataset.travel === 'arrived' && w.dataset.destination === id; }, id);
      await page.waitForTimeout(950);
    };
    await page.goto(preview.base + '/pharmacy/');
    await page.waitForSelector('html[data-world="ready"]');
    await page.waitForTimeout(800);
    event('normal: clinical'); await click(zone('clinical'));
    await page.waitForSelector('#world[data-travel="moving"]');
    assert.equal(await page.locator('#world .zone-label:visible').count(), 5);
    assert.equal(await page.locator('#world .map-tool:visible').count(), 0);
    assert(await page.locator('#detail').isHidden());
    await page.waitForTimeout(1100);
    await page.screenshot({ path: path.join(output, `${name}-walking.png`) });
    await arrived('clinical'); event('normal: arrived clinical');
    await click('#world [data-tool="vanco-auc-calc"]');
    await page.waitForSelector('#detail:not([hidden])');
    await page.waitForTimeout(950);
    await page.screenshot({ path: path.join(output, `${name}-tool.png`) });
    await page.waitForTimeout(900); await click('#close-detail');
    await click('#overview'); await page.waitForTimeout(850);

    event('retarget: start gov'); await click(zone('gov'));
    await page.waitForSelector('#world[data-travel="moving"]');
    await page.waitForTimeout(1100);
    event('retarget: switch ebm'); await click(zone('ebm'));
    await arrived('ebm'); event('retarget: arrived ebm');
    const retargetEvents = await page.evaluate(() => window.demoEvents);
    assert(!retargetEvents.some(item => item.travel === 'arrived' && item.destination === 'gov'));
    await page.screenshot({ path: path.join(output, `${name}-retargeted.png`) });
    await click('#overview'); await page.waitForTimeout(850);

    event('rapid: clinical > adr > internal');
    for (const id of ['clinical', 'adr', 'internal']) await click(zone(id));
    await arrived('internal'); event('rapid: arrived internal');
    const events = await page.evaluate(() => window.demoEvents);
    const rapid = events.slice(events.findLastIndex(item => item.travel === 'idle') + 1);
    assert(!rapid.some(item => item.travel === 'arrived' && ['clinical', 'adr'].includes(item.destination)));
    assert.equal(await page.locator('#world .map-tool:visible').count(), 4);
    await page.screenshot({ path: path.join(output, `${name}-arrived.png`) });
    await page.waitForTimeout(1000);
    assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => window.demoCsp), []);
    const video = page.video();
    await writeFile(path.join(output, `${name}-timeline.json`), JSON.stringify({ timeline, events }, null, 2));
    await context.close();
    const file = path.join(output, `${name}-exploration.webm`);
    await rename(await video.path(), file);
    const metadata = await verifyVideo(file, name, viewport);
    manifest.videos.push({ ...metadata, timeline });
    console.log(name, JSON.stringify(metadata));
  }
  manifest.validation = 'automated-passed-human-review-pending';
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`R5 recordings: ${output}`);
} finally { await browser?.close(); await preview.close(); }
