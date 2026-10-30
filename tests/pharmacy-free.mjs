import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startPharmacyServer } from '../tools/pharmacy-server.mjs';

const server = await startPharmacyServer(); let browser;
try {
  browser = await chromium.launch({ headless:true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  await page.goto(server.base + '/pharmacy/?no3d=1');
  const result = await page.evaluate(async () => {
    const { createWalkable } = await import('/pharmacy/walkable.js');
    const { createJourney } = await import('/pharmacy/journey.js');
    const { auditPharmacySpace } = await import('/pharmacy/spatial-audit.js');
    const { FLOOR_PLAN, NAVIGATION_PLAN:plan } = await import('/pharmacy/scene-layout.js');
    const catalog = await (await fetch('/tools.json')).json(), failures = [], metrics = [];
    let assertions = 0;
    const check = (ok,name) => { assertions++; if (!ok) failures.push(name); };
    const eq = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]) < 1e-7;
    for (const small of [false,true]) {
      const { obstacles,profile } = auditPharmacySpace(catalog,small);
      const startTime = performance.now(), nav = createWalkable({ floor:FLOOR_PLAN,obstacles,profile,plan });
      const buildMs = performance.now()-startTime;
      const start = nav.point(plan.start), targets = plan.nodes.map(n => n.position);
      for (let x=-8.7;x<8.7;x+=1.13) for (let z=-6.7;z<11;z+=1.31) if (nav.contains([x,z])) targets.push([x,z]);
      let routes=0;
      for (const target of targets) {
        const route = nav.route(start,target); if (!route) continue; routes++;
        check(eq(route.points[0],start) && eq(route.points.at(-1),target),'exact unsnapped endpoints');
        for (let i=1;i<route.points.length;i++) {
          const a=route.points[i-1],b=route.points[i],length=Math.hypot(a[0]-b[0],a[1]-b[1]);
          // Independent dense circle-vs-box oracle against real scene bounds.
          for (let s=0;s<=Math.ceil(length/.06);s++) {
            const t=s/Math.max(1,Math.ceil(length/.06)),p=a.map((v,k)=>v+(b[k]-v)*t);
            const gap=Math.min(...obstacles.map(box=>Math.hypot(Math.max(box.minX-p[0],0,p[0]-box.maxX),Math.max(box.minZ-p[1],0,p[1]-box.maxZ))));
            check(gap >= profile.radius+plan.clearance-1e-7,'swept character clears furniture');
          }
        }
      }
      check(routes>35,'arbitrary reachable floor points exist');
      for (const stop of Object.values(plan.stops)) check(Boolean(nav.route(start,nav.point(stop))),'all named work areas remain connected');
      check(!nav.route(start,[100,100]) && !nav.route(start,[NaN,0]) && !nav.route(start,[0,1.6]),'off-floor malformed and hub furniture destinations rejected');
      const journey=createJourney(plan,2.6,nav);
      journey.request('clinical'); journey.advance(.71); const before=journey.snapshot();
      journey.request([.73,6.27]); check(eq(before.position,journey.snapshot().position),'free retarget keeps continuous position');
      const valid=JSON.stringify(journey.snapshot()); let rejected=false;
      try { journey.request([0,1.6]); } catch { rejected=true; }
      check(rejected && JSON.stringify(journey.snapshot())===valid,'invalid click preserves current journey');
      journey.request([.73,6.27],true); check(eq(journey.snapshot().position,[.73,6.27]),'reduced motion preserves exact click');
      check(journey.advance(100).arrived==='point','no stale destination queue');
      metrics.push({small,nodeCount:nav.nodeCount,buildMs,routes});
    }
    const floor={width:10,depth:10,centerZ:0}, profile={radius:.3}, graph={clearance:.1,start:'a',nodes:[{id:'a',position:[-3,0]},{id:'b',position:[-3,2]}],edges:[['a','b']]};
    const box={minX:-.5,maxX:.5,minZ:-1,maxZ:1};
    const around=createWalkable({floor,profile,plan:graph,obstacles:[box]});
    const detour=around.route([-3,0],[3,0]);
    check(detour?.points.length>2,'obstacle forces a real detour');
    check(!around.clear([-3,0],[3,0]),'direct obstacle shortcut blocked');
    const divided=createWalkable({floor,profile,plan:graph,obstacles:[{minX:-.01,maxX:.01,minZ:-5,maxZ:5}]});
    check(divided.contains([3,0]) && !divided.route([-3,0],[3,0]),'valid but disconnected island is rejected');
    let failed=false; try { createWalkable({floor,profile,plan:graph,obstacles:[]}); } catch {failed=true;}
    check(failed,'missing collision data fails closed');
    return {assertions,failures,metrics};
  });
  assert.deepEqual(result.failures,[]); console.log('FREE',JSON.stringify(result));
} finally {await browser?.close();await server.close();}
