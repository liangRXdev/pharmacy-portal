import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const base=process.argv[2],ref=process.argv[3]||'HEAD',output=path.resolve(process.argv[4]||'test-results/phase4-preview');
if(!base||!/^https:\/\//.test(base))throw new Error('Usage: node tools/verify-preview.mjs https://preview-host [git-ref] [new-output-directory]');
await mkdir(output); // Preserve earlier verification batches.
const git=(...args)=>execFileSync('git',args),sha=git('rev-parse',ref).toString().trim();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected=file=>git('cat-file','blob',`${sha}:${file}`);
const checks=[],assets=[];
const check=(name,ok,detail)=>checks.push({name,ok:Boolean(ok),detail});
const get=async(route,headers={})=>fetch(new URL(route,base),{redirect:'manual',headers:{'Cache-Control':'no-cache',...headers},signal:AbortSignal.timeout(30000)});
const files=git('ls-tree','-r','--name-only',sha,'public').toString().trim().split('\n').filter(p=>p!=='public/_headers');
const rootBytes=expected('public/index.html'),rootHash=hash(rootBytes);
for(let offset=0;offset<files.length;offset+=5){
 await Promise.all(files.slice(offset,offset+5).map(async file=>{
  const route=file==='public/index.html'?'/':file==='public/pharmacy/index.html'?'/pharmacy/':'/'+file.slice(7);
  try{
   const response=await get(route),body=Buffer.from(await response.arrayBuffer()),headers=Object.fromEntries(response.headers);
   const actualHash=hash(body),expectedHash=hash(expected(file));
   assets.push({file,route,status:response.status,sha256:actualHash,expectedSha256:expectedHash,headers});
   check(`${route} exact Git blob`,response.status===200&&actualHash===expectedHash,{status:response.status,actualHash,expectedHash});
   if(route.endsWith('.js'))check(`${route} JavaScript MIME`,/javascript/.test(headers['content-type']||''),headers['content-type']);
   if(route.endsWith('.css'))check(`${route} CSS MIME`,/text\/css/.test(headers['content-type']||''),headers['content-type']);
   if(route==='/'||route==='/pharmacy/'){
    const csp=headers['content-security-policy']||'';
    check(`${route} single CSP`,(csp.match(/default-src/g)||[]).length===1&&!csp.includes('unsafe-eval'),csp);
    const script=(csp.match(/(?:^|;)\s*script-src\s+([^;]+)/)||[])[1]||'';
    if(route==='/'){
     const inline=body.toString().match(/<script>([\s\S]*?)<\/script>/)?.[1];
     const digest=inline&&createHash('sha256').update(inline).digest('base64');
     check('root inline CSP matches delivered bytes',digest&&script.includes(`'sha256-${digest}'`)&&!script.includes("'unsafe-inline'"),script);
    }else check('pharmacy local-module CSP',script.trim()==="'self'",script);
    check(`${route} security headers`,headers['x-content-type-options']==='nosniff'&&headers['x-frame-options']==='DENY'&&/frame-ancestors 'none'/.test(csp)&&/max-age=/.test(headers['strict-transport-security']||''),headers);
   }
   if(route==='/sw.js')check('SW cache revalidation',/no-cache/.test(headers['cache-control']||''),headers['cache-control']);
   if(route.startsWith('/pharmacy/')){
    const cache=headers['cache-control']||'',age=Number(cache.match(/(?:^|,)\s*max-age=(\d+)/)?.[1]||0);
    check(`${route} unversioned asset revalidation`,!cache.includes('immutable')&&(age===0||/no-cache|no-store/.test(cache)),cache);
   }
  }catch(error){check(`${route} fetch`,false,error.message);}
 }));
}
for(const[from,to]of[['/index.html','/'],['/pharmacy','/pharmacy/'],['/pharmacy/index.html','/pharmacy/'],['/pharmacy?no3d=1','/pharmacy/?no3d=1']]){
 try{const response=await get(from),location=response.headers.get('location');check(`${from} canonical redirect`,[301,302,307,308].includes(response.status)&&new URL(location,base).href===new URL(to,base).href,{status:response.status,location});}catch(e){check(`${from} redirect`,false,e.message);}
}
for(const route of ['/.git/HEAD','/.env','/package.json','/CLAUDE.md','/pharmacy-desktop-codex-handoff.md','/docs/redesign-r6.md','/tools/record-free-pharmacy.mjs','/_headers']){
 try{const r=await get(route),body=Buffer.from(await r.arrayBuffer());check(`${route} private/config files unavailable`,[403,404].includes(r.status)||(r.status===200&&hash(body)===rootHash),{status:r.status,mime:r.headers.get('content-type'),sha256:hash(body)});}catch(e){check(`${route} exposure probe`,false,e.message);}
}
for(const route of ['/','/pharmacy/','/pharmacy/world.js','/pharmacy/walkable.js','/sw.js']){
 const asset=assets.find(a=>a.route===route),etag=asset?.headers.etag;
 if(!asset)continue; // Older release refs may not contain a newly added module.
 if(!etag){check(`${route} ETag available`,false,'Missing ETag');continue;}
 try{const r=await get(route,{'If-None-Match':etag});check(`${route} conditional revalidation`,r.status===304,{status:r.status,etag});}catch(e){check(`${route} conditional request`,false,e.message);}
}
const report={base,commit:sha,checkedAt:new Date().toISOString(),status:checks.every(c=>c.ok)?'passed':'failed',checks,assets};
await writeFile(path.join(output,'http-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({base,commit:sha,checks:checks.length,failed:checks.filter(c=>!c.ok),assets:assets.length,output}));
if(report.status!=='passed')process.exitCode=1;
