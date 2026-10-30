import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve('public');
const catalog = JSON.parse(await readFile('public/tools.json', 'utf8'));
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
    if (!filename.startsWith(root + path.sep) && filename !== root) throw new Error('path');
    if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
    res.writeHead(200, { ...headersFor(url.pathname), 'content-type': mime[path.extname(filename)] || 'text/plain' });
    res.end(await readFile(filename));
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.PHARMACY_BASE_URL || `http://127.0.0.1:${server.address().port}`;
let browser, checks = 0;
const pass = name => { checks++; console.log('PASS ' + name); };
// Test-only counters. No runtime metrics/quality system is added to the application.
function measureArtFrames() {
  let calls = 0, triangles = 0;
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = callback => raf(time => {
    calls = triangles = 0;
    callback(time);
    if (calls) {
      window.artFrame = { calls, triangles };
      if (window.artPainted === undefined) {
        const canvas = document.querySelector('#world canvas'), gl = canvas?.getContext('webgl2');
        if (gl) {
          const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
          gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          const colors = new Set();
          for (let i = 0; i < pixels.length; i += 400) colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
          window.artPainted = colors.size > 5;
        }
      }
    }
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
  assert(await page.locator('#backup-browser').isHidden(), 'normal mode must not show the fallback directory');
  assert.equal(await page.locator('#world .zone-label:visible').count(), 5);
  assert.equal(await page.locator('#world .map-tool:visible').count(), 0);
  assert.equal(await page.locator('#world .map-tool').count(), catalog.tools.length);
  const csp = await page.evaluate(async () => (await fetch(location.href)).headers.get('content-security-policy'));
  assert.equal((csp.match(/default-src/g) || []).length, 1);
  // The test RAF wrapper reads the fresh framebuffer before compositing clears it.
  // Do not require the production world to render continuously while idle.
  await page.waitForFunction(() => window.artPainted !== undefined);
  const painted = await page.evaluate(() => window.artPainted);
  assert(painted, 'WebGL framebuffer must contain geometry');
  const desktopArt = await page.evaluate(() => window.artFrame);
  assert(desktopArt.calls < 100 && desktopArt.triangles > 0);
  console.log('ART desktop overview', desktopArt);
  pass('desktop actual WebGL world ready, five zones and nonuniform framebuffer');
  const anchorPosition = () => page.locator('.map-links line').first().evaluate(line => [Number(line.getAttribute('x1')), Number(line.getAttribute('y1'))]);
  const beforeFocus = await anchorPosition();
  await page.locator('#world [data-category="clinical"]').click();
  await page.waitForTimeout(850);
  const afterFocus = await anchorPosition();
  assert(Math.hypot(afterFocus[0] - beforeFocus[0], afterFocus[1] - beforeFocus[1]) > 5, 'camera focus must move a projected 3D anchor, independent of labels and highlighting');
  assert.equal(new URL(page.url()).hash, '#/clinical');
  await page.locator('#world [data-tool="vanco-auc-calc"]').click();
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
  assert.match(await page.locator('#scene-title').textContent(), /政府資料庫/);
  await page.goto(base + '/pharmacy/#/clinical/nhi-drug-price-history');
  await page.waitForSelector('html[data-world="ready"]');
  assert.equal(new URL(page.url()).hash, '#/gov/nhi-drug-price-history');
  await page.goto(base + '/pharmacy/?quality=low#/unknown');
  await page.waitForSelector('html[data-world="ready"]');
  assert.equal(new URL(page.url()).hash, '');
  assert.equal(new URL(page.url()).search, '?quality=low');
  pass('deep link, canonical tool category and invalid route fallback');
  const spatial = await page.evaluate(async () => {
    const { auditPharmacySpace, readSceneBounds } = await import('/pharmacy/spatial-audit.js');
    const { findRoute, validateNavigation, segmentBoxDistance } = await import('/pharmacy/navigation.js');
    const { FLOOR_PLAN } = await import('/pharmacy/scene-layout.js');
    const THREE = await import('/pharmacy/vendor/three-lite.js');
    const { createGeometryKit, createPharmacist } = await import('/pharmacy/geometry.js');
    const data = await (await fetch('/tools.json')).json();
    const audits = [auditPharmacySpace(data, false), auditPharmacySpace(data, true)];
    const tests = [];
    const expect = (name, condition) => tests.push({ name, ok: Boolean(condition) });
    const rejects = action => { try { action(); return false; } catch { return true; } };
    const box = { minX: 0, maxX: 1, minZ: 0, maxZ: 1 };
    expect('segment crosses a thin obstacle between clear endpoints', segmentBoxDistance([-10, .5], [10, .5], { ...box, maxX: .001 }) === 0);
    expect('parallel segment distance', segmentBoxDistance([-2, 2], [3, 2], box) === 1);
    expect('corner distance', Math.abs(segmentBoxDistance([-2, -2], [-1, -1], box) - Math.SQRT2) < 1e-9);
    expect('zero length point distance', segmentBoxDistance([2, 2], [2, 2], box) === Math.SQRT2);
    expect('invalid coordinates reject', rejects(() => segmentBoxDistance([NaN, 0], [0, 0], box)));
    expect('inverted bounds reject', rejects(() => segmentBoxDistance([0, 0], [1, 1], { ...box, minX: 2 })));
    for (const audit of audits) {
      const { plan, profile, obstacles, areas, report } = audit;
      const check = candidate => validateNavigation(candidate, obstacles, profile, FLOOR_PLAN, areas);
      expect('real desktop/mobile scene clear', report.ok && report.minimumClearance >= plan.clearance && obstacles.length > 100);
      expect('actor includes arms and is not a point', profile.radius > .5 && profile.width > .9 && profile.height > 1.7);
      // Check actual vertex attributes independently of the AABB measurement.
      // Horizontal radius is invariant under every yaw angle, including turns.
      const actor = new THREE.Scene(), actorResources = [];
      try {
        const kit = createGeometryKit(actor, actorResources);
        createPharmacist(kit, 0, 0, profile.floorY); kit.flush();
        const matrix = new THREE.Object3D().matrix, vertex = new THREE.Vector3();
        let inside = true, vertices = 0;
        for (const mesh of actor.children) for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, matrix);
          const attribute = mesh.geometry.getAttribute('position');
          for (let j = 0; j < attribute.count; j++) {
            vertex.fromBufferAttribute(attribute, j).applyMatrix4(matrix); vertices++;
            inside &&= Math.hypot(vertex.x, vertex.z) <= profile.radius + 1e-6 && vertex.y <= profile.floorY + profile.height + 1e-6;
          }
        }
        expect('all actor vertices fit the turn envelope', inside && vertices > 100);
      } finally { actorResources.forEach(resource => resource.dispose()); }
      const nodes = plan.nodes.map(node => node.id), positions = new Map(plan.nodes.map(node => [node.id, node.position]));
      const distance = nodes.map((a, i) => nodes.map((b, j) => i === j ? 0 : Infinity));
      for (const [a, b] of plan.edges) {
        const i = nodes.indexOf(a), j = nodes.indexOf(b), p = positions.get(a), q = positions.get(b);
        distance[i][j] = distance[j][i] = Math.hypot(p[0] - q[0], p[1] - q[1]);
      }
      // Floyd-Warshall independently checks every pair against the route planner.
      for (let k = 0; k < nodes.length; k++) for (let i = 0; i < nodes.length; i++) for (let j = 0; j < nodes.length; j++) distance[i][j] = Math.min(distance[i][j], distance[i][k] + distance[k][j]);
      const edges = new Set(plan.edges.flatMap(([a, b]) => [a + ':' + b, b + ':' + a]));
      for (let i = 0; i < nodes.length; i++) for (let j = 0; j < nodes.length; j++) {
        const route = findRoute(plan, nodes[i], nodes[j]);
        let cost = 0, valid = route?.[0] === nodes[i] && route.at(-1) === nodes[j];
        for (let k = 1; k < (route?.length || 0); k++) {
          const a = positions.get(route[k - 1]), b = positions.get(route[k]);
          cost += Math.hypot(a[0] - b[0], a[1] - b[1]);
          valid &&= edges.has(route[k - 1] + ':' + route[k]);
        }
        expect(`route ${nodes[i]} to ${nodes[j]}`, valid && Math.abs(cost - distance[i][j]) < 1e-8);
      }
      const broken = structuredClone(plan);
      broken.edges = broken.edges.filter(edge => !edge.includes('clinical'));
      expect('unreachable stop cannot pass', !check(broken).ok && findRoute(broken, 'entrance', 'clinical') === null);
      const missing = structuredClone(plan); delete missing.stops.gov;
      expect('missing stop cannot pass', !check(missing).ok);
      const shared = structuredClone(plan); shared.stops.gov = shared.stops.adr;
      expect('two categories cannot silently share a stop', !check(shared).ok);
      const swapped = structuredClone(plan); [swapped.stops.gov, swapped.stops.adr] = [swapped.stops.adr, swapped.stops.gov];
      expect('category stops cannot be swapped to the wrong work areas', !check(swapped).ok);
      const nonfinite = structuredClone(plan); nonfinite.nodes[0].position[0] = Infinity;
      expect('nonfinite node cannot pass', !check(nonfinite).ok);
      expect('empty obstacle list cannot give a false green', !validateNavigation(plan, [], profile, FLOOR_PLAN, areas).ok);
      expect('zero sized actor cannot pass', !validateNavigation(plan, obstacles, { ...profile, radius: 0 }, FLOOR_PLAN, areas).ok);
      expect('unknown route endpoint rejects', rejects(() => findRoute(plan, 'entrance', 'unknown')));
      // Insert an actual rotated mesh halfway along the east aisle. Clear end
      // nodes must not hide a collision between them.
      const fixture = new THREE.Scene(), geometry = new THREE.BoxGeometry(.05, 1.5, 2), material = new THREE.MeshStandardMaterial();
      try {
        const mesh = new THREE.InstancedMesh(geometry, material, 1), transform = new THREE.Object3D();
        transform.position.set(1.5, .9, 1); transform.rotation.y = Math.PI / 4; transform.updateMatrix();
        mesh.position.x = 1; mesh.setMatrixAt(0, transform.matrix); fixture.add(mesh);
        const measured = readSceneBounds(fixture);
        expect('rotated geometry bounds follow mesh transform', measured.length === 1 && measured[0].minX < 1.8 && measured[0].maxX > 3.2);
        expect('new mid-route furniture is detected', !validateNavigation(plan, [...obstacles, ...measured], profile, FLOOR_PLAN, areas).ok);
        mesh.dispose();
      } finally { geometry.dispose(); material.dispose(); }
    }
    return { failed: tests.filter(test => !test.ok), assertions: tests.length,
      metrics: audits.map(audit => ({ small: audit.small, profile: audit.profile, minimumClearance: audit.report.minimumClearance, obstacles: audit.obstacles.length })) };
  });
  assert.deepEqual(spatial.failed, []);
  console.log('SPATIAL', JSON.stringify({ assertions: spatial.assertions, metrics: spatial.metrics }));
  pass('R3 actual geometry clearance, every route pair, rotated obstruction and fail-closed invalid plans');
  const views = await page.evaluate(async () => {
    const THREE = await import('/pharmacy/vendor/three-lite.js');
    const { cameraFrame } = await import('/pharmacy/camera-framing.js');
    const { createToolMarkers } = await import('/pharmacy/tool-art.js');
    const { createPharmacyArt } = await import('/pharmacy/art.js');
    const { createWalkingPharmacist } = await import('/pharmacy/pharmacist.js');
    const { NAVIGATION_PLAN } = await import('/pharmacy/scene-layout.js');
    const { readSceneBounds } = await import('/pharmacy/spatial-audit.js');
    const catalog = await (await fetch('/tools.json')).json();
    const failed = [], measurements = [];
    for (const small of [false, true]) {
      const scene = new THREE.Scene(), resources = [];
      try {
        const markers = createToolMarkers(scene, resources, catalog.categories, catalog.tools);
        createPharmacyArt(scene, resources, { small, ...catalog, markers });
        const avatar = createWalkingPharmacist(scene, resources);
        avatar.pose({ position: [.25, 1.8] });
        scene.updateMatrixWorld(true);
        const frame = (mode, categoryId, marker) => {
          const width = small ? 366 : 1326, height = small ? (mode === 'overview' ? 340 : mode === 'hub' ? 420 : mode === 'tool' ? 320 : 534) : 760;
          const camera = new THREE.PerspectiveCamera(small ? 43 : 34, width / height, .1, 150);
          const pose = cameraFrame({ mode, categoryId, marker, aspect: camera.aspect, fov: camera.fov, small });
          camera.position.copy(pose.position); camera.lookAt(pose.target); camera.updateMatrixWorld(true);
          if (camera.position.y < 1.5) failed.push(`${small} ${mode}: camera below working height`);
          return camera;
        };
        const overview = frame('overview');
        let maximumExtent = 0;
        for (const box of readSceneBounds(scene)) for (const x of [box.minX, box.maxX]) for (const y of [box.minY, box.maxY]) for (const z of [box.minZ, box.maxZ]) {
          const p = new THREE.Vector3(x, y, z).project(overview);
          maximumExtent = Math.max(maximumExtent, Math.abs(p.x), Math.abs(p.y));
          if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || p.z < -1 || p.z > 1) failed.push(`${small}: overview clips scene bounds`);
        }
        const visible = (camera, point) => {
          const direction = point.clone().sub(camera.position).normalize();
          const ray = new THREE.Raycaster(camera.position, direction);
          const hit = ray.intersectObjects(scene.children, true)[0];
          return hit && hit.point.distanceTo(point) < .4;
        };
        const hub = frame('hub');
        if (!visible(hub, new THREE.Vector3(.25, 1.65, 2.02)) || !visible(hub, new THREE.Vector3(.25, 1.3, 1.98))) failed.push(`${small}: pharmacist head or coat is occluded`);
        for (const tool of catalog.tools) {
          avatar.pose({ position: NAVIGATION_PLAN.nodes.find(node => node.id === NAVIGATION_PLAN.stops[tool.category]).position });
          scene.updateMatrixWorld(true);
          const marker = markers.get(tool.id), p = marker.position.clone(); p.z += .075;
          for (const mode of ['category', 'tool']) {
            const camera = frame(mode, tool.category, marker.position);
            const projected = p.clone().project(camera);
            if (Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1 || !visible(camera, p)) failed.push(`${small} ${mode}: device ${tool.id} clipped or occluded`);
          }
        }
        measurements.push({ small, maximumExtent });
      } finally { resources.forEach(resource => resource.dispose()); }
    }
    return { failed, measurements };
  });
  assert.deepEqual(views.failed, []);
  console.log('FRAMING', JSON.stringify(views.measurements));
  pass('R4 full-scene fit, actual mesh visibility of pharmacist and all category/tool close-ups');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#explore').click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#world').getAttribute('data-view'), 'hub');
  assert.equal(await page.locator('#scene-title').textContent(), 'Rx Hub · 藥師工作站');
  assert.equal(await page.locator('#world .room-label:visible').count(), 0);
  await page.locator('#overview').click();
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('#world').dataset.view === 'hub');
  await page.goForward();
  await page.waitForFunction(() => document.querySelector('#world').dataset.view === 'overview');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  pass('R4 near-pharmacist view, return to overview and back/forward view restoration');
  async function checkMapTools(target, touch = false) {
    // Bulk data/visibility checks use the reduced-motion path; normal camera motion
    // is separately verified above against actual projected 3D coordinates.
    await target.emulateMedia({ reducedMotion: 'reduce' });
    // Playwright 1.56 polls the immediate return value. Load modules before
    // polling so a Promise cannot be mistaken for a satisfied predicate.
    await target.evaluate(async () => {
      const [THREE, framing, layout] = await Promise.all([
        import('/pharmacy/vendor/three-lite.js'), import('/pharmacy/camera-framing.js'), import('/pharmacy/scene-layout.js'),
      ]);
      window.__testFraming = { THREE, cameraFrame: framing.cameraFrame, resolveToolPosition: layout.resolveToolPosition };
    });
    for (const category of catalog.categories) {
      await target.locator('#overview').click();
      const zone = target.locator(`#world [data-category="${category.id}"]`);
      if (touch) await zone.tap(); else await zone.click();
      await target.waitForTimeout(850);
      const expected = catalog.tools.filter(tool => tool.category === category.id);
      const labels = target.locator('#world .map-tool:visible');
      assert.equal(await labels.count(), expected.length, `${category.id}: every tool must have a visible map label`);
      assert(await target.locator('#backup-browser').isHidden());
      const world = await target.locator('#world').boundingBox();
      const boxes = await labels.evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }));
      for (const [i, box] of boxes.entries()) {
        assert(box.height >= 44 && box.x >= world.x && box.y >= world.y && box.x + box.width <= world.x + world.width + 1 && box.y + box.height <= world.y + world.height + 1, 'map labels must fit the scene with 44px touch targets');
        for (const other of boxes.slice(i + 1)) assert(box.x + box.width <= other.x || other.x + other.width <= box.x || box.y + box.height <= other.y || other.y + other.height <= box.y, 'tool labels must not overlap');
      }
      for (const tool of expected) {
        const button = target.locator(`#world [data-tool="${tool.id}"]`);
        if (touch) await button.tap(); else await button.click();
        await target.waitForTimeout(100);
        assert.equal(new URL(target.url()).hash, `#/${tool.category}/${tool.id}`);
        assert.equal(await target.locator('#detail-title').textContent(), tool.nameZh);
        await target.waitForFunction(() => [...document.querySelectorAll('.map-links line')].filter(line => line.style.display !== 'none').length === 1);
        // A single visible line can still carry its previous category-view
        // anchor until the pending on-demand frame completes. Wait for the
        // actual projection, keeping the same strict geometry assertion.
        const framingHandle = await target.waitForFunction(({ category, index }) => {
          const { THREE, cameraFrame, resolveToolPosition } = window.__testFraming;
          const world = document.querySelector('#world'), rect = world.getBoundingClientRect();
          const small = world.clientWidth < 768;
          const marker = new THREE.Vector3(...resolveToolPosition(category, index));
          const camera = new THREE.PerspectiveCamera(small ? 43 : 34, rect.width / rect.height, .1, 150);
          const pose = cameraFrame({ mode: 'tool', categoryId: category, marker, aspect: camera.aspect, fov: camera.fov, small });
          camera.position.copy(pose.position); camera.lookAt(pose.target); camera.updateMatrixWorld(true);
          marker.y += .35; marker.project(camera);
          const expected = [(marker.x + 1) * rect.width / 2, (1 - marker.y) * rect.height / 2];
          const line = [...document.querySelectorAll('.map-links line')].find(line => line.style.display !== 'none');
          if (!line) return false;
          const actual = [Number(line.getAttribute('x1')), Number(line.getAttribute('y1'))];
          const x = rect.x + actual[0], y = rect.y + actual[1], panel = document.querySelector('#detail').getBoundingClientRect();
          const result = { error: Math.hypot(actual[0] - expected[0], actual[1] - expected[1]), inside: actual[0] > 0 && actual[0] < rect.width && actual[1] > 0 && actual[1] < rect.height,
            covered: x >= panel.left && x <= panel.right && y >= panel.top && y <= panel.bottom };
          return result.inside && !result.covered && result.error < 2 ? result : false;
        }, { category: tool.category, index: expected.indexOf(tool) }, { polling: 100, timeout: 5000 });
        const framing = await framingHandle.jsonValue();
        assert(framing.inside && !framing.covered && framing.error < 2, `${tool.id}: rendered close-up anchor must match the camera frame and avoid the detail panel: ${JSON.stringify(framing)}`);
        assert((await target.locator('#detail-content').textContent()).includes(tool.description));
        const links = await target.locator('#detail a').evaluateAll(nodes => nodes.map(a => a.href));
        assert.deepEqual(links, [tool.url, tool.repo].filter(value => typeof value === 'string' && value.startsWith('https://')));
        await target.locator('#close-detail').click();
        assert(await button.evaluate(node => node === document.activeElement), 'closing details returns focus to the same map tool');
      }
    }
    await target.locator('#overview').click();
    await target.emulateMedia({ reducedMotion: 'no-preference' });
  }
  await checkMapTools(page);
  // Use the actual projected controls with keyboard only, including focus return.
  const zone = page.locator('#world [data-category="clinical"]');
  await zone.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#world').dataset.travel === 'arrived' && document.querySelector('#world').dataset.destination === 'clinical');
  assert(await page.evaluate(() => document.activeElement.matches('#world .map-tool')), 'arrival focuses a map tool for keyboard users');
  await page.keyboard.press('Tab');
  assert(await page.evaluate(() => document.activeElement.matches('#world .map-tool')));
  await page.keyboard.press('Enter');
  assert(await page.locator('#detail').isVisible());
  await page.keyboard.press('Escape');
  assert.equal(new URL(page.url()).hash, '');
  assert(await page.locator('#overview').evaluate(node => node === document.activeElement));
  pass('all 22 tools reachable only through the map, complete details, nonoverlapping labels and keyboard navigation');
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
  assert(await page.locator('#backup-browser').isVisible());
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
  // 1280x900 at 200% browser zoom has a 640x450 CSS viewport.
  const zoom = await browser.newContext({ viewport: { width: 640, height: 450 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const zoomPage = await zoom.newPage();
  await zoomPage.goto(base + '/pharmacy/');
  await zoomPage.waitForSelector('html[data-world="ready"]');
  await zoomPage.locator('#world [data-category="gov"]').click();
  await zoomPage.waitForTimeout(300);
  assert.equal(await zoomPage.locator('#world .map-tool:visible').count(), 7);
  assert(await zoomPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await zoomPage.locator('#world [data-tool="nhi-drug-price-history"]').click();
  assert.equal(await zoomPage.locator('#detail-title').textContent(), '健保藥價歷史查詢');
  await zoomPage.locator('#close-detail').click();
  await zoom.close();
  pass('200 percent equivalent viewport: map labels, detail controls and no horizontal overflow');
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
  assert(await phone.locator('#backup-browser').isHidden());
  assert.equal(await phone.locator('#world .zone-label:visible').count(), 5);
  assert(await phone.locator('canvas').evaluate(el => el.width / el.clientWidth <= 1.5));
  const canvasBounds = await phone.locator('canvas').boundingBox();
  const touch = await mobile.newCDPSession(phone);
  const x = canvasBounds.x + canvasBounds.width / 2, y = canvasBounds.y + canvasBounds.height / 2;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }, { x: x + 30, y: y + 30, id: 2 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 20, y, id: 1 }, { x: x + 50, y: y + 30, id: 2 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(new URL(phone.url()).hash, '', 'pinch must not select a tool or room');
  await touch.detach();
  await checkMapTools(phone, true);
  await phone.locator('#world [data-category="internal"]').tap();
  await phone.waitForTimeout(850);
  await phone.locator('#world .map-tool:visible').first().tap();
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
  pass('mobile touch access to all 22 map tools, DPR cap, bottom sheet, 44px controls, zero errors/CSP');
  assert.deepEqual(allCsp, []);
  console.log(`${checks} smoke groups passed; Android hardware acceptance remains manual.`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
