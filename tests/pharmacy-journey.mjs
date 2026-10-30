import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startPharmacyServer } from '../tools/pharmacy-server.mjs';

const server = await startPharmacyServer();
let browser;
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.base + '/pharmacy/?no3d=1');
  await page.waitForSelector('html[data-world="fallback"]');
  const result = await page.evaluate(async () => {
    const { NAVIGATION_PLAN: plan } = await import('/pharmacy/scene-layout.js');
    const { createJourney, routeFromPosition } = await import('/pharmacy/journey.js');
    const { createWorld } = await import('/pharmacy/world.js');
    const THREE = await import('/pharmacy/vendor/three-lite.js');
    const { createWalkingPharmacist, measureWalkingProfile } = await import('/pharmacy/pharmacist.js');
    const failures = [], events = [];
    let assertions = 0;
    const check = (condition, name) => { assertions++; if (!condition) failures.push(name); };
    const eq = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-7;
    const node = id => plan.nodes.find(n => n.id === id).position;
    const onEdge = (p, a, b) => Math.abs(Math.hypot(p[0]-a[0], p[1]-a[1]) + Math.hypot(p[0]-b[0], p[1]-b[1]) - Math.hypot(a[0]-b[0], a[1]-b[1])) < 1e-7;
    for (const [a, b] of plan.edges) for (const fraction of [.2, .5, .8]) for (const stop of Object.values(plan.stops)) {
      const start = node(a).map((v, i) => v + (node(b)[i] - v) * fraction);
      const route = routeFromPosition(plan, start, stop);
      check(eq(route.points[0], start) && eq(route.points.at(-1), node(stop)), 'continuous route endpoints');
      for (let i = 1; i < route.points.length; i++) check(plan.edges.some(([x,y]) => onEdge(route.points[i-1], node(x), node(y)) && onEdge(route.points[i], node(x), node(y))), 'no shortcut outside fixed edges');
    }
    const journey = createJourney(plan);
    journey.request('clinical'); journey.advance(.73);
    const before = journey.snapshot();
    journey.request('ebm');
    check(eq(before.position, journey.snapshot().position), 'retarget does not teleport');
    const same = journey.snapshot(); journey.request('ebm');
    check(same.revision === journey.snapshot().revision, 'same target does not restart');
    for (const stop of ['clinical', 'adr', 'internal']) journey.request(stop);
    check(journey.advance(100).arrived === 'internal', 'rapid clicks finish only last target');
    check(journey.advance(100).arrived === 'internal', 'old destinations never queued');
    const snapshot = JSON.stringify(journey.snapshot());
    for (const action of [() => journey.request('missing'), () => journey.advance(-1), () => journey.advance(NaN)]) {
      let threw = false; try { action(); } catch { threw = true; }
      check(threw && JSON.stringify(journey.snapshot()) === snapshot, 'invalid action preserves state');
    }
    journey.request('gov', true);
    check(!journey.snapshot().moving && eq(journey.snapshot().position, node('gov')), 'reduced motion positions immediately');
    journey.request('clinical'); journey.advance(.4); const cancelled = journey.cancel();
    check(eq(cancelled.position, journey.advance(100).position) && !journey.snapshot().destination, 'cancel holds current legal position');

    const scene = new THREE.Scene(), resources = [], profile = measureWalkingProfile();
    try {
      const avatar = createWalkingPharmacist(scene, resources), matrix = new THREE.Object3D().matrix, vertex = new THREE.Vector3();
      for (let phase = 0; phase < 16; phase++) for (let turn = 0; turn < 8; turn++) {
        avatar.pose({ position: [0, 0], moving: true, travelled: phase * Math.PI / 8 / 4.2, yaw: turn * Math.PI / 4 });
        scene.updateMatrixWorld(true);
        let radius = 0, bottom = Infinity, top = 0;
        scene.traverse(mesh => {
          if (!mesh.isMesh) return;
          const vertices = mesh.geometry.attributes.position;
          for (let instance = 0; instance < mesh.count; instance++) {
            mesh.getMatrixAt(instance, matrix);
            for (let i = 0; i < vertices.count; i++) {
              vertex.fromBufferAttribute(vertices, i).applyMatrix4(matrix).applyMatrix4(mesh.matrixWorld);
              radius = Math.max(radius, Math.hypot(vertex.x, vertex.z)); bottom = Math.min(bottom, vertex.y); top = Math.max(top, vertex.y);
            }
          }
        });
        check(radius <= profile.radius + 1e-6 && top <= profile.floorY + profile.height + 1e-6 && bottom >= profile.floorY - 1e-6, 'actual gait vertices stay in validated envelope and above floor');
      }
    } finally { resources.forEach(resource => resource.dispose()); }

    // A real renderer/RAF instance: sample the actual avatar and camera, not just controller state.
    const container = document.querySelector('#world'); container.hidden = false;
    const catalog = await (await fetch('/tools.json')).json();
    const runtimeErrors = [], wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const world = createWorld({ container, ...catalog, onSelectCategory() {}, onSelectTool() {},
      onJourneyState: state => events.push(state), onError: error => runtimeErrors.push(error.message) });
    try {
      const initialCamera = world.getJourneyState().cameraTarget;
      world.focusCategory('clinical');
      await wait(550);
      const moving = world.getJourneyState();
      check(moving.moving && !eq(moving.position, node('entrance')), 'RAF moves actual avatar');
      check(Math.abs(moving.legAngle) > .001, 'actual articulated leg moves');
      const cameraDistance = target => Math.hypot(target[0] - moving.position[0], target[1] - moving.position[1]);
      check(!eq(initialCamera, moving.cameraTarget) && cameraDistance(moving.cameraTarget) < cameraDistance(initialCamera), 'camera follows actual moving avatar');
      check(container.querySelectorAll('.map-tool:not([hidden])').length === 0, 'no tools before arrival');
      world.setPaused(true); const paused = world.getJourneyState(); await wait(300);
      check(eq(paused.position, world.getJourneyState().position), 'hidden-page pause holds position');
      world.focusCategory('ebm'); const switched = world.getJourneyState();
      check(eq(paused.position, switched.position) && switched.destination === 'ebm', 'runtime retarget preserves actual position');
      world.setPaused(false); await wait(300);
      check(!eq(paused.position, world.getJourneyState().position), 'resume continues from paused position');
      world.focusCategory('clinical'); world.focusCategory('adr'); world.focusCategory('internal');
      check(world.getJourneyState().destination === 'internal', 'runtime last destination wins');
      world.resetView(); const reset = world.getJourneyState(); await wait(150);
      check(!reset.moving && eq(reset.position, world.getJourneyState().position), 'overview cancels walk in place');
      check(!events.some(e => e.arrived && ['clinical', 'ebm', 'adr'].includes(e.arrived)), 'cancelled stations never emit arrival');
      check(!runtimeErrors.length, 'runtime has no errors');
    } finally { world.destroy(); }
    check(!container.querySelector('canvas') && !container.dataset.travel, 'destroy removes actor renderer and travel state');
    return { assertions, failures };
  });
  assert.deepEqual(result.failures, []); assert.deepEqual(errors, []);
  console.log(`PASS R5 ${result.assertions} continuous-route, interruption, reduced-motion and actual RAF assertions`);
} finally { await browser?.close(); await server.close(); }
