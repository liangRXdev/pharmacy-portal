import {chromium} from 'playwright';
import {startPharmacyServer} from '../tools/pharmacy-server.mjs';
import {instrumentFreeWorld,runFreeScenarios} from '../tools/free-walk-scenarios.mjs';
const server=await startPharmacyServer();let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [device,viewport]of[['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
    const context=await browser.newContext({viewport,...(device==='mobile'?{isMobile:true,hasTouch:true}:{} )});
    const page=await context.newPage();await instrumentFreeWorld(page);
    console.log('FREE UI',device,JSON.stringify(await runFreeScenarios(page,process.env.PHARMACY_BASE_URL||server.base,{device})));
    await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#overview').click();await page.waitForTimeout(100);
    const click=await page.evaluate(async()=>{
      const THREE=await import('/pharmacy/vendor/three-lite.js'),rect=document.querySelector('#world canvas').getBoundingClientRect();
      const p=new THREE.Vector3(.73,.145,7.3).project(window.__freeCamera);
      return {x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2};
    });
    if(device==='mobile')await page.touchscreen.tap(click.x,click.y);else await page.mouse.click(click.x,click.y);
    const immediate=await page.evaluate(()=>window.__freeState());
    if(immediate.moving||!immediate.arrived||Math.hypot(immediate.position[0]-immediate.target[0],immediate.position[1]-immediate.target[1])>1e-7)throw new Error('Reduced motion must arrive at the exact free point immediately');
    console.log('FREE UI',device,'reduced motion exact immediate arrival passed');
    await context.close();
  }
}finally{await browser?.close();await server.close();}
