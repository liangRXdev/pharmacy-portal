import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve('public');
const rules = [];
for (const line of (await readFile('public/_headers', 'utf8')).split('\n')) {
  if (!line.trim() || line.trimStart().startsWith('#')) continue;
  if (!/^\s/.test(line)) rules.push({ pattern: line.trim(), headers: [] });
  else rules.at(-1).headers.push(line.trim());
}
function headersFor(url) {
  const headers = {};
  for (const rule of rules) {
    if (!(rule.pattern.endsWith('*') ? url.startsWith(rule.pattern.slice(0, -1)) : url === rule.pattern)) continue;
    for (const line of rule.headers) {
      if (line.startsWith('! ')) { delete headers[line.slice(2).toLowerCase()]; continue; }
      const colon = line.indexOf(':');
      const key = line.slice(0, colon).toLowerCase(), value = line.slice(colon + 1).trim();
      headers[key] = headers[key] ? headers[key] + ', ' + value : value;
    }
  }
  return headers;
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/index.html' || url.pathname === '/pharmacy' || url.pathname === '/pharmacy/index.html') {
      res.writeHead(307, { location: (url.pathname === '/index.html' ? '/' : '/pharmacy/') + url.search }); res.end(); return;
    }
    let filename = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!filename.startsWith(root + '/') && filename !== root) throw new Error('path');
    if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
    res.writeHead(200, { ...headersFor(url.pathname), 'content-type': mime[path.extname(filename)] || 'text/plain' });
    res.end(await readFile(filename));
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser, checks = 0;
const pass = name => { checks++; console.log('PASS ' + name); };
// Test-only counters. No runtime metrics/quality system is added to the application.
function measureArtFrames() {
  let calls = 0, triangles = 0;
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = callback => raf(time => {
    calls = triangles = 0;
    callback(time);
    if (calls) window.artFrame = { calls, triangles };
  });
  const prototype = WebGL2RenderingContext.prototype;
  for (const method of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
    const original = prototype[method];
    prototype[method] = function (...args) {
      calls++;
      if (args[0] === this.TRIANGLES) triangles += (method.includes('Elements') ? args[1] : args[2]) / 3 * (method.includes('Instanced') ? args.at(-1) : 1);
      return original.apply(this, args);
    };
  }
}
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(measureArtFrames);
  await context.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', e => window.cspViolations.push(e.violatedDirective));
  });
  const allCsp = [];
  await context.exposeBinding('recordCsp', (_source, directive) => allCsp.push(directive));
  await context.addInitScript(() => document.addEventListener('securitypolicyviolation', e => window.recordCsp(e.violatedDirective)));
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('request', req => requests.push(req.url()));
  await page.goto(base + '/');
  await page.waitForSelector('.tool-card');
  assert(!requests.some(url => /\/pharmacy\/|three|world\.js/.test(url)));
  pass('root zero-3D and existing portal renders');
  await page.locator('#searchInput').fill('Vancomycin');
  await page.waitForFunction(() => document.querySelectorAll('.tool-card').length === 1);
  await page.locator('#searchInput').fill('');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.tool-card').length === 22);
  await context.setOffline(false);
  // Network errors during this deliberate offline check are expected.
  // External font availability is outside this repo; retain all application/CSP errors.
  const appErrors = errors.filter(message => !message.includes('net::ERR_'));
  assert.deepEqual(appErrors, []);
  assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
  errors.length = 0;
  await page.goto(base + '/pharmacy/');
  await page.waitForSelector('html[data-world="ready"]');
  assert.equal(await page.locator('#categories button').count(), 6);
  assert.equal(await page.locator('#tools button').count(), 22);
  const csp = await page.evaluate(async () => (await fetch(location.href)).headers.get('content-security-policy'));
  assert.equal((csp.match(/default-src/g) || []).length, 1);
  // Read within the same frame as a fresh render. More than one pixel color proves drawn geometry.
  const painted = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl2');
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 400) colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
    resolve(colors.size > 5);
  })));
  assert(painted, 'WebGL framebuffer must contain geometry');
  const desktopArt = await page.evaluate(() => window.artFrame);
  assert(desktopArt.calls < 100 && desktopArt.triangles > 0);
  console.log('ART desktop overview', desktopArt);
  pass('desktop actual WebGL world ready, five zones and nonuniform framebuffer');
  const beforeFocus = await page.locator('.room-label').filter({ hasText: '臨床計算' }).boundingBox();
  await page.locator('[data-category="clinical"]').click();
  await page.waitForTimeout(700);
  const afterFocus = await page.locator('.room-label').filter({ hasText: '臨床計算' }).boundingBox();
  assert(Math.hypot(afterFocus.x - beforeFocus.x, afterFocus.y - beforeFocus.y) > 5, 'camera must actually move');
  assert.equal(new URL(page.url()).hash, '#/clinical');
  await page.locator('[data-tool="vanco-auc-calc"]').click();
  await page.waitForSelector('#detail:not([hidden])');
  assert.equal(await page.locator('#detail a').count(), 2);
  assert.equal(await page.locator('#detail a').first().getAttribute('rel'), 'noopener noreferrer');
  await page.keyboard.press('Escape');
  assert.equal(new URL(page.url()).hash, '');
  assert(await page.locator('#detail').isHidden());
  await page.goBack();
  await page.waitForSelector('#detail:not([hidden])');
  pass('category, tool details, links, escape and browser history');
  await page.goto(base + '/pharmacy/#/gov');
  await page.waitForSelector('html[data-world="ready"]');
  assert.equal(await page.locator('#list-title').textContent(), '政府資料庫');
  await page.goto(base + '/pharmacy/#/clinical/nhi-drug-price-history');
  await page.waitForSelector('html[data-world="ready"]');
  assert.equal(new URL(page.url()).hash, '#/gov/nhi-drug-price-history');
  await page.goto(base + '/pharmacy/?quality=low#/unknown');
  await page.waitForSelector('html[data-world="ready"]');
  assert.equal(new URL(page.url()).hash, '');
  assert.equal(new URL(page.url()).search, '?quality=low');
  pass('deep link, canonical tool category and invalid route fallback');
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls = (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(req => new URL(req.url).pathname)))).flat();
    return { keys, urls };
  });
  const shellSource = await readFile('public/sw.js', 'utf8');
  const shellVersion = shellSource.match(/const CACHE = `\$\{PREFIX\}(v\d+)`;/)[1];
  assert(cached.keys.includes('pharmacy-portal-' + shellVersion));
  assert(!cached.urls.some(url => url.startsWith('/pharmacy/')));
  pass('controlling portal SW does not cache or replace pharmacy resources');
  await page.goto(base + '/pharmacy/?no3d=1');
  await page.waitForSelector('html[data-world="fallback"]');
  await page.locator('[data-category="internal"]').click();
  await page.locator('#tools button').first().click();
  assert.match(await page.locator('#detail').textContent(), /Restricted/);
  assert.equal(await page.locator('#detail a').count(), 0);
  assert.equal(await page.locator('canvas').count(), 0);
  await page.locator('#close-detail').click();
  const fallbackHash = new URL(page.url()).hash;
  await page.locator('#browse-tools').click();
  assert.equal(new URL(page.url()).hash, fallbackHash);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'browser');
  pass('no3d DOM browser, restricted tools and hash-safe browse action');
  assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
  assert.deepEqual(errors, []);
  pass('desktop zero console errors and CSP violations');
  const fixtureContext = await browser.newContext({ serviceWorkers: 'block' });
  const fixture = await fixtureContext.newPage();
  const data = JSON.parse(await readFile('public/tools.json', 'utf8'));
  data.categories.push({ id: 'future', label: '未來分類' });
  data.tools.push({ id: 'future-tool', category: 'future', nameZh: '<img src=x onerror=alert(1)>', name: 'Future', description: '<script>bad()</script>', url: 'javascript:alert(1)', repo: 'http://example.com', tags: [], platform: 'test', status: 'active' });
  await fixture.route('**/tools.json', route => route.fulfill({ json: data }));
  await fixture.goto(base + '/pharmacy/#/future/future-tool');
  await fixture.waitForSelector('html[data-world="ready"]');
  assert.equal(await fixture.locator('#detail-title').textContent(), '<img src=x onerror=alert(1)>');
  assert.equal(await fixture.locator('#detail img, #detail script, #detail a').count(), 0);
  await fixture.unroute('**/tools.json');
  pass('unknown category/tool generic slot and safe text/HTTPS-only links');
  await fixture.route('**/pharmacy/world.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: 'throw new Error("simulated module failure")' }));
  await fixture.goto(base + '/pharmacy/');
  await fixture.waitForSelector('html[data-world="fallback"]');
  assert.equal(await fixture.locator('#tools button').count(), 22);
  await fixture.unroute('**/pharmacy/world.js');
  pass('module failure preserves DOM tool browser');
  await fixture.goto(base + '/pharmacy/');
  await fixture.waitForSelector('html[data-world="ready"]');
  const lifecycle = await fixture.evaluate(async () => {
    const { createWorld } = await import('/pharmacy/world.js');
    const THREE = await import('/pharmacy/vendor/three-lite.js');
    const data = await (await fetch('/tools.json')).json();
    const host = document.createElement('div');
    host.style.cssText = 'width:400px;height:300px';
    document.body.append(host);
    let geometries = 0, materials = 0, textures = 0;
    const disposed = new Set(), allocated = new Set();
    const ga = THREE.BufferGeometry.prototype.setAttribute, mv = THREE.Material.prototype.setValues;
    const bounds = THREE.InstancedMesh.prototype.computeBoundingSphere, instanceDispose = THREE.InstancedMesh.prototype.dispose;
    THREE.InstancedMesh.prototype.computeBoundingSphere = function (...args) { allocated.add(this); return bounds.apply(this, args); };
    THREE.InstancedMesh.prototype.dispose = function () { record(this); instanceDispose.call(this); };
    const textureUpdate = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(THREE.CanvasTexture.prototype), 'needsUpdate').set;
    // Track application primitives; renderer-owned background/shadow helpers are released with its context.
    THREE.BufferGeometry.prototype.setAttribute = function (...args) { if (['BoxGeometry', 'CylinderGeometry', 'SphereGeometry'].includes(this.type)) allocated.add(this); return ga.apply(this, args); };
    THREE.Material.prototype.setValues = function (...args) { if (this.isMeshStandardMaterial) allocated.add(this); return mv.apply(this, args); };
    Object.defineProperty(THREE.CanvasTexture.prototype, 'needsUpdate', { configurable: true, set(value) { if (value) allocated.add(this); textureUpdate.call(this, value); } });
    const allReleased = () => [...allocated].every(resource => disposed.has(resource));
    let duplicateDisposal = false;
    const record = resource => { if (disposed.has(resource)) duplicateDisposal = true; disposed.add(resource); };
    const gd = THREE.BufferGeometry.prototype.dispose, md = THREE.Material.prototype.dispose, td = THREE.CanvasTexture.prototype.dispose;
    THREE.BufferGeometry.prototype.dispose = function () { record(this); geometries++; gd.call(this); };
    THREE.Material.prototype.dispose = function () { record(this); materials++; md.call(this); };
    THREE.CanvasTexture.prototype.dispose = function () { record(this); textures++; td.call(this); };
    const options = { container: host, ...data, onSelectCategory() {}, onSelectTool() {}, onError(error) { throw error; } };
    const results = [];
    try {
      for (let i = 0; i < 3; i++) {
        const world = createWorld(options);
        const gl = host.querySelector('canvas').getContext('webgl2');
        world.destroy();
        const count = geometries, materialCount = materials, textureCount = textures;
        world.destroy();
        results.push(host.children.length === 0 && gl.isContextLost() && geometries === count && materials === materialCount && textures === textureCount && !duplicateDisposal && allReleased());
      }
      const count = geometries, materialCount = materials, textureCount = textures;
      const observe = ResizeObserver.prototype.observe;
      ResizeObserver.prototype.observe = () => { throw new Error('simulated setup failure'); };
      try { createWorld(options); results.push(false); }
      catch { results.push(host.children.length === 0 && geometries > count && materials > materialCount && textures > textureCount && !duplicateDisposal && allReleased()); }
      finally { ResizeObserver.prototype.observe = observe; }
    } finally {
      THREE.InstancedMesh.prototype.computeBoundingSphere = bounds;
      THREE.InstancedMesh.prototype.dispose = instanceDispose;
      THREE.BufferGeometry.prototype.setAttribute = ga;
      THREE.Material.prototype.setValues = mv;
      delete THREE.CanvasTexture.prototype.needsUpdate;
      THREE.BufferGeometry.prototype.dispose = gd;
      THREE.Material.prototype.dispose = md;
      THREE.CanvasTexture.prototype.dispose = td;
      host.remove();
    }
    return results;
  });
  assert(lifecycle.every(Boolean), 'repeated destroy and failed initialization must release resources');
  await fixture.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await fixture.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  assert.equal(await fixture.locator('canvas').count(), 1);
  await fixture.evaluate(() => document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await fixture.waitForSelector('html[data-world="fallback"]');
  assert.equal(await fixture.locator('#world canvas, #world .room-label').count(), 0);
  assert.equal(await fixture.locator('#tools button').count(), 22);
  pass('resource disposal, partial-init cleanup, cached-page restoration and context-loss fallback');
  await fixtureContext.close();
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await mobile.addInitScript(measureArtFrames);
  const phone = await mobile.newPage();
  const mobileErrors = [];
  phone.on('pageerror', e => mobileErrors.push(e.message));
  phone.on('console', msg => { if (msg.type() === 'error') mobileErrors.push(msg.text()); });
  await mobile.addInitScript(() => { window.cspViolations = []; document.addEventListener('securitypolicyviolation', e => window.cspViolations.push(e.violatedDirective)); });
  await phone.goto(base + '/pharmacy/');
  await phone.waitForSelector('html[data-world="ready"]');
  await phone.waitForFunction(() => window.artFrame?.calls > 0);
  const mobileArt = await phone.evaluate(() => window.artFrame);
  assert(mobileArt.calls <= desktopArt.calls && mobileArt.triangles < desktopArt.triangles);
  console.log('ART mobile overview', mobileArt);
  assert(await phone.locator('#categories').evaluate(el => el.scrollWidth > el.clientWidth));
  assert(await phone.locator('canvas').evaluate(el => el.width / el.clientWidth <= 1.5));
  const canvasBounds = await phone.locator('canvas').boundingBox();
  const touch = await mobile.newCDPSession(phone);
  const x = canvasBounds.x + canvasBounds.width / 2, y = canvasBounds.y + canvasBounds.height / 2;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }, { x: x + 30, y: y + 30, id: 2 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 20, y, id: 1 }, { x: x + 50, y: y + 30, id: 2 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(new URL(phone.url()).hash, '', 'pinch must not select a tool or room');
  await touch.detach();
  await phone.locator('[data-category="internal"]').click();
  await phone.locator('#tools button').first().click();
  const bounds = await phone.locator('#detail').boundingBox();
  assert(bounds.y + bounds.height <= 845 && bounds.x >= 0);
  assert(await phone.locator('#close-detail').evaluate(el => el.getBoundingClientRect().height >= 44));
  assert.deepEqual(mobileErrors, []);
  assert.deepEqual(await phone.evaluate(() => window.cspViolations), []);
  await mkdir('test-results', { recursive: true });
  await phone.screenshot({ path: 'test-results/pharmacy-mobile.png' });
  await page.goto(base + '/pharmacy/');
  await page.waitForSelector('html[data-world="ready"]');
  await page.screenshot({ path: 'test-results/pharmacy-desktop.png', fullPage: true });
  pass('mobile WebGL, scrollable nav, DPR cap, bottom sheet, 44px control, zero errors/CSP');
  assert.deepEqual(allCsp, []);
  console.log(`${checks} smoke groups passed; Android hardware acceptance remains manual.`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
