// check-portal-mutations.mjs — 守門力測試：每個「錯誤實作」都必須讓 tools/check-portal.js fail
//
// 用法：node tests/check-portal-mutations.mjs
//
// 作法：把 public/ 與 tools/ 複製到暫存目錄，套用一個突變，執行暫存目錄內的
// check-portal.js；突變後仍 exit 0 即代表「CI 綠但規則沒守住」。
// 未變動的副本必須 PASS，避免檢查本身壞掉時每個突變都「被抓到」。
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');

const MUTATIONS = [
  ['index.html 行內 script 改動但未更新 hash', 'public/index.html', s => s.replace('let debounceTimer;', 'let debounceTimer; let x;')],
  ['root script-src 加 unsafe-inline', 'public/_headers', s => s.replace("script-src 'sha256-", "script-src 'unsafe-inline' 'sha256-")],
  ['root script-src 加外部來源', 'public/_headers', s => s.replace(/(script-src 'sha256-[^']+')/, '$1 https://cdn.example.com')],
  ['pharmacy script-src 加外部來源', 'public/_headers', s => s.replace("script-src 'self';", "script-src 'self' https://cdn.example.com;")],
  ['pharmacy script-src 加 unsafe-inline', 'public/_headers', s => s.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")],
  ['root connect-src 放寬', 'public/_headers', s => s.replace("connect-src 'self'", "connect-src 'self' https://api.example.com")],
  ['pharmacy connect-src 放寬', 'public/_headers', s => s.replace(/(\/pharmacy\/\*[\s\S]*?)connect-src 'self'/, "$1connect-src 'self' https://api.example.com")],
  ['root CSP 移除 frame-ancestors', 'public/_headers', s => s.replace(" frame-ancestors 'none';", '')],
  ['pharmacy CSP 移除 object-src', 'public/_headers', s => s.replace(/(\/pharmacy\/\*[\s\S]*?) object-src 'none';/, '$1')],
  ['SHELL 指向不存在的檔案', 'public/sw.js', s => s.replace("'icons/icon-192.png'", "'icons/icon-193.png'")],
  ['SHELL 加回 index.html', 'public/sw.js', s => s.replace("  './',\n", "  './',\n  'index.html',\n")],
  ['SHELL 加入 pharmacy 資產', 'public/sw.js', s => s.replace("  'tools.json',", "  'tools.json',\n  'pharmacy/vendor/three-lite.js',")],
  ['index.html 加 inline event handler', 'public/index.html', s => s.replace('<input type="text" id="searchInput"', '<input onclick="alert(1)" type="text" id="searchInput"')],
  ['pharmacy/index.html 加 inline event handler', 'public/pharmacy/index.html', s => s.replace('<button id="overview" type="button">', '<button id="overview" type="button" onclick="alert(1)">')],
  ['tools.json 重複 id', 'public/tools.json', s => s.replace('"id": "bicarb-dosing-calc"', '"id": "faers-suspect-ranker"')],
  ['tools.json url 改為 http', 'public/tools.json', s => s.replace('"url": "https://liangrxdev.github.io/bicarb', '"url": "http://liangrxdev.github.io/bicarb')],
  ['tools.json repo 改為 javascript:', 'public/tools.json', s => s.replace('"repo": "https://github.com/liangRXdev/bicarb-dosing-calc"', '"repo": "javascript:alert(1)"')],
  ['pharmacy 以非字面值動態 import', 'public/pharmacy/main.js', s => s.replace(/boot\(\);\s*$/, 'import(`https://cdn.example.com/x.js`);\nboot();\n')],
];

function run(mutate, file) {
  const dir = mkdtempSync(path.join(tmpdir(), 'check-portal-'));
  try {
    for (const sub of ['public', 'tools']) cpSync(path.join(ROOT, sub), path.join(dir, sub), { recursive: true });
    if (mutate) {
      const target = path.join(dir, file);
      const before = readFileSync(target, 'utf8');
      const after = mutate(before);
      if (after === before) return { applied: false };
      writeFileSync(target, after);
    }
    const result = spawnSync(process.execPath, [path.join(dir, 'tools', 'check-portal.js')], { encoding: 'utf8' });
    return { applied: true, status: result.status, output: result.stdout + result.stderr };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

let failures = 0;
const baseline = run(null);
if (baseline.status !== 0) {
  console.error('FAIL  未突變的副本沒有通過 check-portal.js：\n' + baseline.output);
  process.exit(1);
}
console.log('PASS  未突變副本通過');
for (const [label, file, mutate] of MUTATIONS) {
  const { applied, status } = run(mutate, file);
  if (!applied) { failures++; console.error(`FAIL  突變未套用（錨點已變，請更新本測試）：${label}`); }
  else if (status === 0) { failures++; console.error(`MISS  check-portal 未擋下：${label}`); }
  else console.log(`PASS  擋下：${label}`);
}
console.log(failures ? `\n${failures} / ${MUTATIONS.length} 個突變未被擋下` : `\n全部 ${MUTATIONS.length} 個突變皆被擋下`);
process.exit(failures ? 1 : 0);
