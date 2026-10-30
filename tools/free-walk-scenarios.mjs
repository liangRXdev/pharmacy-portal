import assert from 'node:assert/strict';
import path from 'node:path';

export async function instrumentFreeWorld(page) {
  // Test-only observation of the actual rendered camera/actor. Product assets
  // expose no debug globals and the scenario still uses real pointer events.
  await page.route('**/pharmacy/world.js', async route => {
    const response=await route.fetch();
    const body=(await response.text())
      .replaceAll('renderer.render(scene, camera);','window.__freeCamera = camera; window.__freeScene = scene; renderer.render(scene, camera);')
      .replace('const point = [physical.point.x,physical.point.z];','const point = [physical.point.x,physical.point.z]; window.__freeClicked = point.slice(); window.__freeClickCount = (window.__freeClickCount || 0) + 1;')
      .replace('function blocked(event) {','function blocked(event) { window.__freeRejected = (window.__freeRejected || 0) + 1;')
      .replace('function journeyState() {','window.__freeState = journeyState; window.__freeNavigation = navigation;\n    function journeyState() {');
    await route.fulfill({response,body});
  });
}

export async function runFreeScenarios(page,base,{device='desktop',output}={}) {
  const errors=[],timeline=[],started=Date.now();
  page.on('pageerror',e=>errors.push(e.message));
  const state=()=>page.evaluate(()=>window.__freeState());
  const event=label=>timeline.push({label,seconds:(Date.now()-started)/1000});
  const screenshot=async name=>{if(output) await page.screenshot({path:path.join(output,`${device}-${name}.png`)});};
  const tap=async(x,y)=>device==='mobile'?page.touchscreen.tap(x,y):page.mouse.click(x,y);
  async function locate(candidates,blocked=false,fallback=false) {
    return page.evaluate(async({candidates,blocked,fallback})=>{
      const THREE=await import('/pharmacy/vendor/three-lite.js'),canvas=document.querySelector('#world canvas'),rect=canvas.getBoundingClientRect();
      const ray=new THREE.Raycaster(),camera=window.__freeCamera,scene=window.__freeScene,nav=window.__freeNavigation;
      const currentState=window.__freeState(),current=currentState.position;
      const screens=blocked?[[.5,.03],[.95,.9],[.05,.9],[.5,.2],[.85,.5],[.15,.5]].map(([x,y])=>[rect.x+x*rect.width,rect.y+y*rect.height]):candidates.map(([x,z])=>{
        const p=new THREE.Vector3(x,.145,z).project(camera);return [rect.x+(p.x+1)*rect.width/2,rect.y+(1-p.y)*rect.height/2];
      });
      if(fallback)for(const y of [.7,.8,.6,.45,.9])for(const x of [.35,.65,.25,.75,.45,.55])screens.push([rect.x+x*rect.width,rect.y+y*rect.height]);
      for(const [x,y] of screens){
        if(x<rect.x+5||x>rect.right-5||y<rect.y+5||y>rect.bottom-5||document.elementFromPoint(x,y)!==canvas)continue;
        ray.setFromCamera(new THREE.Vector2((x-rect.x)/rect.width*2-1,1-(y-rect.y)/rect.height*2),camera);
        const hit=ray.intersectObjects(scene.children,true).find(h=>h.object.visible);
        if(blocked){if(!hit || (hit.object.userData.kind!=='tool' && hit.point.y>.19)) return {x,y};}
        else if(hit && hit.point.y<=.19){
          const point=[hit.point.x,hit.point.z],route=nav.route(current,point);
          if(fallback && currentState.target && Math.hypot(point[0]-currentState.target[0],point[1]-currentState.target[1])<.5)continue;
          const margin=!fallback||[[.25,0],[-.25,0],[0,.25],[0,-.25]].every(([dx,dz])=>nav.contains([point[0]+dx,point[1]+dz]));
          if(route && margin && (!fallback || Math.hypot(current[0]-point[0],current[1]-point[1])>.65))return {x,y,point,segments:route.points.length-1};
        }
      }
      return null;
    },{candidates,blocked,fallback});
  }
  const clickFloor=async(candidates,fallback=false)=>{
    for(let attempt=0;attempt<3;attempt++){
      const target=await locate(candidates,false,fallback);assert(target,`${device}: a visible reachable ground point must exist`);
      const before=await state(),observed=await page.evaluate(()=>({rejections:window.__freeRejected||0,clicks:window.__freeClickCount||0}));
      await tap(target.x,target.y);
      const accepted=await state();
      if(accepted.revision===before.revision){
        // Native input and coordinate observation cross separate browser tasks.
        // If the following camera moves furniture under the pointer, the
        // product must explicitly reject it and preserve the old destination.
        const after=await page.evaluate(()=>({rejections:window.__freeRejected||0,clicks:window.__freeClickCount||0,point:window.__freeClicked}));
        assert.deepEqual(accepted.target,before.target,'moving-camera obstruction preserves the previous journey');
        if(after.rejections!==observed.rejections+1){
          // Repeating the exact current destination is intentionally idempotent.
          assert.equal(after.clicks,observed.clicks+1,'an unhandled floor click must fail rather than silently retry');
          assert.deepEqual(after.point,before.target,'a handled non-rejected click without a new revision must be the same destination');
        }
        continue;
      }
      const clicked=await page.evaluate(()=>window.__freeClicked);
      assert.deepEqual(accepted.target,clicked,'actual ground hit is preserved without snapping');
      return {...target,point:accepted.target};
    }
    assert.fail(`${device}: no new destination after three explicitly handled native clicks`);
  };
  const arrived=async()=>{await page.waitForFunction(()=>Boolean(window.__freeState().arrived));await page.waitForTimeout(850);};
  await page.goto(base+'/pharmacy/');await page.waitForSelector('html[data-world="ready"]');await page.waitForTimeout(850);
  event('free click behind Rx Hub: route around furniture');
  const first=await clickFloor([[0,-4.7],[1,-4.3],[-1,-4.3],[.5,-5.5],[-.5,-5.5]]);
  assert(first.segments>1,'real furniture must cause a detour');
  await page.waitForSelector('#world[data-travel="moving"]');await page.waitForTimeout(700);
  assert.equal(await page.locator('.map-tool:visible').count(),0);await screenshot('walking');
  await arrived();
  assert.equal((await state()).categoryId,undefined);assert.equal(await page.locator('.map-tool:visible').count(),0);
  assert.equal(await page.locator('.zone-label:visible').count(),5);
  event('normal arrival in central aisle: no tool names');await screenshot('central-arrival');
  await page.locator('#overview').click();await page.waitForTimeout(850);
  await clickFloor([[0,8.3],[.8,8.3],[-.8,8.3],[0,7]]);await page.waitForTimeout(700);
  const before=await state(),invalid=await locate([],true);assert(invalid,'visible invalid click target exists');
  event('invalid click: preserve old journey');await tap(invalid.x,invalid.y);
  await page.waitForSelector('.walk-feedback:not([hidden])');
  const after=await state();assert.equal(after.revision,before.revision);assert.deepEqual(after.target,before.target);
  await screenshot('blocked');await page.waitForTimeout(500);
  event('retarget from current position');
  let p=(await state()).position;
  const local=p=>[[p[0]+1,p[1]-1.3],[p[0]-1,p[1]-1.3],[p[0]+1,p[1]+1.2],[p[0]-1,p[1]+1.2],[0,5.5],[.9,6.2],[-.9,6.2]];
  await clickFloor(local(p),true);await page.waitForTimeout(300);await screenshot('retarget');
  event('rapid free destinations: last click wins');
  let last;
  for(let i=0;i<3;i++){p=(await state()).position;last=await clickFloor(local(p).reverse(),true);}
  await arrived();
  const final=await state();assert(Math.hypot(final.position[0]-last.point[0],final.position[1]-last.point[1])<.03);
  await screenshot('arrived');
  event('free arrival near clinical reveals tools');
  await page.locator('#overview').click();await page.waitForTimeout(850);
  const workPoints=[[5.6,-2.4],[3.2,-2.6],[5.2,-2.4],[7.8,-2.4],[6.8,-2.4]];
  for(let z=-2.5;z>=-6.5;z-=.4)for(let x=2.6;x<=8.2;x+=.4)workPoints.push([x,z]);
  await clickFloor(workPoints);
  await arrived();
  assert.equal((await state()).categoryId,'clinical');assert.equal(await page.locator('#world .map-tool:visible').count(),6);
  const atWork=(await state()).position;
  await page.locator('#world [data-tool="vanco-auc-calc"]').click();await page.waitForSelector('#detail:not([hidden])');await page.waitForTimeout(850);
  assert.deepEqual((await state()).position,atWork,'tool details preserve freely chosen standing position');await screenshot('tool');
  await page.goBack();await arrived();assert.deepEqual((await state()).position,atWork,'history restores the free destination');
  await page.waitForTimeout(750);assert.deepEqual(errors,[]);
  return {timeline,first,finalPosition:final.position,errors};
}
