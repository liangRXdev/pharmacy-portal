import path from 'node:path';
import {mkdir,rename,writeFile} from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {startPharmacyServer} from './pharmacy-server.mjs';
import {instrumentFreeWorld,runFreeScenarios} from './free-walk-scenarios.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve('test-results/playwright-runtime');
const {chromium}=await import('playwright');
const {registry}=await import('../node_modules/playwright-core/lib/server/registry/index.js');
const ffmpeg=registry.findExecutable('ffmpeg').executablePath(),run=promisify(execFile);
const output=path.resolve(process.argv[2]||'test-results/r6-recording-01');
await mkdir(output);
const server=await startPharmacyServer();let browser;
const manifest={validation:'pending',audio:false,videos:[]};
async function verify(file,viewport,name){
  let probe='';try{await run(ffmpeg,['-hide_banner','-i',file]);}catch(e){probe=e.stderr||'';}
  const duration=probe.match(/Duration: (\d+):(\d+):(\d+\.\d+)/),video=probe.match(/Video: ([^,]+),[^\n]*? (\d+)x(\d+)[^\n]*? ([\d.]+) fps/);
  assert(duration&&video);
  const seconds=Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3]);
  assert(Number(video[2])===viewport.width&&Number(video[3])===viewport.height&&seconds>5);
  await new Promise((resolve,reject)=>{
    const child=spawn(ffmpeg,['-v','error','-xerror','-i',file,'-c:v','png','-compression_level','0','-f','image2','-update','1','pipe:1']);
    let bytes=0,error='';child.stdout.on('data',b=>bytes+=b.length);child.stderr.on('data',b=>error=(error+b).slice(-4000));
    child.on('error',reject);child.on('exit',code=>code===0&&bytes>1024?resolve():reject(new Error(error)));
  });
  for(const [label,at]of[['start',2],['middle',seconds/2],['end',seconds-1]])await run(ffmpeg,['-v','error','-n','-ss',String(at),'-i',file,'-frames:v','1','-c:v','png','-f','image2',path.join(output,`${name}-${label}.png`)]);
  return {file:path.basename(file),width:viewport.width,height:viewport.height,codec:video[1],fps:Number(video[4]),durationSeconds:seconds,fullDecode:true};
}
try{
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [device,viewport]of[['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
    const context=await browser.newContext({viewport,recordVideo:{dir:path.join(output,device),size:viewport},...(device==='mobile'?{isMobile:true,hasTouch:true}:{})});
    const page=await context.newPage();await instrumentFreeWorld(page);
    const scenario=await runFreeScenarios(page,server.base,{device,output}),video=page.video();
    await context.close();const file=path.join(output,`${device}-free-walk.webm`);await rename(await video.path(),file);
    const metadata=await verify(file,viewport,device);manifest.videos.push({...metadata,...scenario});console.log(device,JSON.stringify(metadata));
  }
  manifest.validation='automated-passed-human-review-pending';await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));console.log(output);
}finally{await browser?.close();await server.close();}
