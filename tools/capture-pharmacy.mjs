// Local or PHARMACY_BASE_URL visual review; local mode emulates route headers.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createLayoutPreview } from './layout-preview.mjs';

const root = path.resolve('public');
const output = path.resolve(process.argv[2] || 'test-results/r1');
const rules = [];
for (const line of (await readFile('public/_headers', 'utf8')).split('\n')) {
  if (!line.trim() || line.trimStart().startsWith('#')) continue;
  if (!/^\s/.test(line)) rules.push({ pattern: line.trim(), headers: [] });
  else rules.at(-1).headers.push(line.trim());
}
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const headers = {};
    for (const rule of rules) {
      if (!(rule.pattern.endsWith('*') ? pathname.startsWith(rule.pattern.slice(0, -1)) : pathname === rule.pattern)) continue;
      for (const line of rule.headers) {
        if (line.startsWith('! ')) { delete headers[line.slice(2).toLowerCase()]; continue; }
        const colon = line.indexOf(':');
        const key = line.slice(0, colon).toLowerCase(), value = line.slice(colon + 1).trim();
        headers[key] = headers[key] ? headers[key] + ', ' + value : value;
      }
    }
    let filename = path.resolve(root, '.' + decodeURIComponent(pathname));
    if (!filename.startsWith(root + path.sep) && filename !== root) throw new Error('path');
    if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
    res.writeHead(200, { ...headers, 'content-type': mime[path.extname(filename)] || 'text/plain' });
    res.end(await readFile(filename));
  } catch { res.writeHead(404); res.end('Not found'); }
});
let browser;
const metrics = [];
try {
  await mkdir(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.PHARMACY_BASE_URL || `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const layoutSvg = createLayoutPreview(JSON.parse(await readFile('public/tools.json', 'utf8')));
  await writeFile(path.join(output, 'layout-preview.svg'), layoutSvg);
  const plan = await browser.newPage({ viewport: { width: 760, height: 880 }, deviceScaleFactor: 2 });
  await plan.setContent(`<body style="margin:0">${layoutSvg}</body>`);
  await plan.screenshot({ path: path.join(output, 'layout-preview.png') });
  await plan.close();
  for (const [name, viewport] of [['desktop', { width: 1440, height: 1100 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce',
      ...(name === 'mobile' ? { isMobile: true, hasTouch: true } : {}),
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      let calls=0,triangles=0; const raf=requestAnimationFrame;
      window.requestAnimationFrame=fn=>raf(time=>{calls=triangles=0;fn(time);if(calls)window.__reviewFrame={calls,triangles};});
      for(const method of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){
        const original=WebGL2RenderingContext.prototype[method];
        WebGL2RenderingContext.prototype[method]=function(...args){calls++;if(args[0]===this.TRIANGLES)triangles+=(method.includes('Elements')?args[1]:args[2])/3*(method.includes('Instanced')?args.at(-1):1);return original.apply(this,args);};
      }
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/pharmacy/`);
    await page.waitForSelector('html[data-world="ready"]');
    const audit = await page.evaluate(async small => {
      const { auditPharmacySpace } = await import('/pharmacy/spatial-audit.js');
      return auditPharmacySpace(await (await fetch('/tools.json')).json(), small);
    }, name === 'mobile');
    await writeFile(path.join(output, `${name}-spatial-audit.json`), JSON.stringify(audit, null, 2));
    assert(audit.report.ok, `${name} spatial audit: ${audit.report.issues.join('; ')}`);
    console.log(`${name}: character radius ${audit.profile.radius.toFixed(3)}, minimum clearance ${audit.report.minimumClearance.toFixed(3)}, ${audit.obstacles.length} scene bounds`);
    const navigationSvg = createLayoutPreview(JSON.parse(await readFile('public/tools.json', 'utf8')), audit);
    await writeFile(path.join(output, `${name}-navigation.svg`), navigationSvg);
    const navigation = await browser.newPage({ viewport: { width: 760, height: 880 }, deviceScaleFactor: 2 });
    await navigation.setContent(`<body style="margin:0">${navigationSvg}</body>`);
    await navigation.screenshot({ path: path.join(output, `${name}-navigation.png`) });
    await navigation.close();
    if (process.argv.includes('--audit-only')) { await context.close(); continue; }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    metrics.push({device:name,base,frame:await page.evaluate(()=>window.__reviewFrame)});
    await page.screenshot({ path: path.join(output, `${name}-overview.png`), fullPage: true });
    await page.locator('.scene-shell').screenshot({ path: path.join(output, `${name}-scene.png`) });
    if (name === 'desktop') {
      await page.locator('.zone-label, .map-links').evaluateAll(labels => labels.forEach(label => { label.style.visibility = 'hidden'; }));
      await page.locator('.scene-shell').screenshot({ path: path.join(output, 'desktop-no-labels.png') });
      await page.locator('.zone-label, .map-links').evaluateAll(labels => labels.forEach(label => { label.style.visibility = ''; }));
    }
    await page.locator('#explore').click();
    await page.waitForTimeout(300);
    await page.locator('.scene-shell').screenshot({ path: path.join(output, `${name}-hub.png`) });
    if(await page.locator('#detail[data-content="author"]').isVisible()){
      await page.screenshot({path:path.join(output,`${name}-author-panel.png`),fullPage:name==='desktop'});
      await page.locator('#detail').evaluate(node=>{node.style.visibility='hidden';});
      await page.locator('.scene-shell').screenshot({path:path.join(output,`${name}-hub-focus.png`)});
      await page.locator('#detail').evaluate(node=>{node.style.visibility='';});
    }
    for (const id of ['clinical', 'ebm', 'adr', 'gov', 'internal']) {
      await page.locator('#overview').click();
      await page.locator(`#world [data-category="${id}"]`).click();
      await page.waitForTimeout(300);
      await page.locator('.scene-shell').screenshot({ path: path.join(output, `${name}-${id}.png`) });
    }
    await page.locator('#overview').click();
    await page.locator('#world [data-category="clinical"]').click();
    await page.locator('#world [data-tool="vanco-auc-calc"]').click();
    await page.waitForTimeout(300); // allow the reduced-motion resize frame to draw
    await page.screenshot({ path: path.join(output, `${name}-tool-detail.png`) });
    assert.deepEqual(errors, [], `${name} must render without JavaScript errors`);
    await context.close();
  }
  await writeFile(path.join(output,'art-metrics.json'),JSON.stringify(metrics,null,2));
  console.log(`Visual review screenshots: ${output}`,JSON.stringify(metrics));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
