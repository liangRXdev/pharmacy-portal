import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startPharmacyServer} from '../tools/pharmacy-server.mjs';
const server=await startPharmacyServer();let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const [device,viewport]of[['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,...(device==='mobile'?{isMobile:true,hasTouch:true}:{})}),page=await context.newPage(),requests=[],errors=[];
  page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.base+'/pharmacy/');await page.waitForSelector('html[data-world="ready"]');
  assert.equal(await page.locator('#scene-title').textContent(),'選擇工作區開始探索');
  assert.equal(await page.locator('#scene-help').textContent(),'藥師會帶你前往，抵達後即可查看工具。');
  assert.equal(await page.locator('#scene-secondary').textContent(),'也可以點選地面自由移動。');
  await page.locator('#explore').focus();await page.keyboard.press('Enter');
  await page.waitForSelector('#world[data-travel="moving"]');assert(await page.locator('#detail').isHidden(),'author information waits until arrival');
  await page.waitForSelector('#detail[data-content="author"]:not([hidden])');await page.waitForTimeout(850);
  assert.equal(await page.locator('#detail-title').textContent(),'梁哲嘉藥師');
  assert.equal(await page.locator('.author-role').textContent(),'Clinical Pharmacist · EBM · Healthcare Tool Developer');
  const link=page.locator('.author-link');
  const bounds=await link.boundingBox();assert(bounds.height>=44&&bounds.width>=44&&bounds.y>=0&&bounds.y+bounds.height<=viewport.height);
  const panel=await page.locator('#detail').boundingBox(),world=await page.locator('#world').boundingBox();
  if(device==='mobile'){
   assert(panel.height<=321 && panel.width<=viewport.width);
   const covered=Math.max(0,Math.min(panel.y+panel.height,world.y+world.height)-Math.max(panel.y,world.y));
   assert(covered/world.height<=.5,'author bottom sheet must leave most of the scene visible');
  }
  assert.equal(await link.evaluate(n=>getComputedStyle(n).color),'rgb(255, 255, 255)');
  await link.focus();assert(await link.evaluate(n=>n===document.activeElement));
  await page.locator('#close-detail').click();assert(await page.locator('#explore').evaluate(n=>n===document.activeElement));
  await page.locator('#explore').click();await page.waitForSelector('#detail[data-content="author"]:not([hidden])');
  await page.keyboard.press('Escape');assert(await page.locator('#detail').isHidden());assert(await page.locator('#overview').evaluate(n=>n===document.activeElement));
  await page.locator('#explore').click();await page.waitForSelector('#detail[data-content="author"]:not([hidden])');
  await page.evaluate(()=>document.querySelector('#world canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForSelector('html[data-world="fallback"]');assert(await page.locator('#detail').isHidden());assert.equal(await page.locator('#tools button').count(),22);
  assert(!requests.some(url=>new URL(url).hostname==='github.com'||url.includes('api.github.com')),'Hub creates no GitHub runtime requests');
  assert.deepEqual(errors,[]);await context.close();console.log('PASS author identity, normal arrival, accessible close/Escape, mobile bounds and context loss',device);
 }
 const context=await browser.newContext({reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();
 const catalog=JSON.parse(await readFile('public/tools.json','utf8'));catalog.tools.shift();
 await page.route('**/tools.json',route=>route.fulfill({json:catalog}));
 await page.goto(server.base+'/pharmacy/');await page.waitForSelector('html[data-world="ready"]');
 await page.locator('#explore').click();await page.waitForSelector('#detail[data-content="author"]:not([hidden])');
 assert.equal(await page.locator('.author-summary').textContent(),`${catalog.categories.length} 個工作領域 · ${catalog.tools.length} 項工具`);
 await context.close();console.log('PASS author summary follows the loaded catalog, including changed tool count');
}finally{await browser?.close();await server.close();}
