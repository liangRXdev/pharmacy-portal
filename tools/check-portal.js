/* check-portal.js — 部署前不變量檢查（CI 與本機共用）
 *
 * 用法：node tools/check-portal.js
 *
 * 檢查：
 *   1) public/tools.json 可 JSON.parse，且每個工具的 category 都存在於 categories
 *   2) public/index.html 每段可執行的行內 <script> 之 sha256，與 public/_headers
 *      CSP script-src 的 hash 集合完全一致（缺 → JS 被擋；多 → 殘留舊 hash）
 *   3) `/` 與 `/pharmacy/*` 實際生效的 CSP 各恰 1 條，script-src 只含 hash／'self'，
 *      connect-src 等底線指令不得放寬
 *   4) public/sw.js SHELL 每項存在於 public/，且不含 index.html
 *
 * 守門力由 tests/check-portal-mutations.mjs 驗證：新增檢查時一併新增突變。
 *
 * 「shell 變動須升 sw.js CACHE」與「gen-seo 產出無 diff」需要 git 歷史，
 * 由 .github/workflows/check.yml 處理。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUB = path.join(__dirname, '..', 'public');
let failures = 0;
const fail = (msg) => { console.error('FAIL  ' + msg); failures += 1; };
const pass = (msg) => console.log('PASS  ' + msg);

// ── 1) tools.json ──
try {
  const d = JSON.parse(fs.readFileSync(path.join(PUB, 'tools.json'), 'utf8'));
  const cats = new Set((d.categories || []).map((c) => c.id));
  const bad = (d.tools || []).filter((t) => !cats.has(t.category)).map((t) => t.id);
  if (!Array.isArray(d.tools) || d.tools.length === 0) fail('tools.json 沒有 tools');
  else if (bad.length) fail('tools.json 有未定義的 category：' + bad.join(', '));
  else pass(`tools.json 可解析（${d.tools.length} 工具，${cats.size} 分類）`);
} catch (e) {
  fail('tools.json 無法解析：' + e.message);
}

// ── 2) CSP hash ──
const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const actual = new Set();
for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
  const attrs = m[1] || '';
  if (/\bsrc\s*=/i.test(attrs)) continue;                       // 外部檔不靠 hash
  const type = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
  if (type && !/^(text\/javascript|module)$/i.test(type)) continue; // data block（JSON-LD）不受 script-src 管
  actual.add("'sha256-" + crypto.createHash('sha256').update(m[2], 'utf8').digest('base64') + "'");
}

const headers = fs.readFileSync(path.join(PUB, '_headers'), 'utf8');

// 依 Cloudflare _headers 語意算出某路徑實際收到的標頭：所有符合的規則依序疊加，
// 同名標頭以多個值並存（CSP 多條 = 瀏覽器取交集），`! Name` 移除先前規則設的值。
const RULES = [];
for (const line of headers.split('\n')) {
  if (!line.trim() || line.trimStart().startsWith('#')) continue;
  if (!/^\s/.test(line)) RULES.push({ pattern: line.trim(), lines: [] });
  else if (RULES.length) RULES[RULES.length - 1].lines.push(line.trim());
}
function headersFor(url) {
  const out = {};
  for (const { pattern, lines } of RULES) {
    if (!(pattern.endsWith('*') ? url.startsWith(pattern.slice(0, -1)) : url === pattern)) continue;
    for (const line of lines) {
      if (line.startsWith('! ')) { delete out[line.slice(2).trim().toLowerCase()]; continue; }
      const colon = line.indexOf(':');
      const key = line.slice(0, colon).trim().toLowerCase();
      (out[key] || (out[key] = [])).push(line.slice(colon + 1).trim());
    }
  }
  return out;
}
function directives(policy) {
  const map = new Map();
  for (const part of policy.split(';')) {
    const [name, ...tokens] = part.trim().split(/\s+/);
    if (name) map.set(name.toLowerCase(), tokens);
  }
  return map;
}
// 兩條路由共同的 CSP 底線；script-src 各自另驗
const CSP_BASELINE = {
  'default-src': ["'self'"],
  'connect-src': ["'self'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"],
  'object-src': ["'none'"],
};
function checkPolicy(route, label) {
  const values = headersFor(route)['content-security-policy'] || [];
  if (values.length !== 1) { fail(`${label} 應恰有 1 條 CSP，實際 ${values.length} 條（多條會取交集）`); return null; }
  const policy = directives(values[0]);
  for (const [name, expected] of Object.entries(CSP_BASELINE)) {
    const actual = policy.get(name) || [];
    if (actual.join(' ') !== expected.join(' ')) fail(`${label} CSP ${name} 應為 ${expected.join(' ')}，實際「${actual.join(' ')}」`);
  }
  if (/unsafe-eval/.test(values[0]) || values[0].split(/[\s;]+/).some((t) => t.includes('*'))) fail(`${label} CSP 含 unsafe-eval 或萬用字元來源`);
  return policy;
}

const rootPolicy = checkPolicy('/', '/');
const rootScript = rootPolicy?.get('script-src') || [];
const extra = rootScript.filter((t) => !/^'sha256-[A-Za-z0-9+/=]+'$/.test(t));
if (extra.length) fail('/ CSP script-src 只允許行內 script 的 sha256 hash，多出：' + extra.join(' '));
const declared = new Set(rootScript.filter((s) => s.startsWith("'sha256-")));

const missing = [...actual].filter((h) => !declared.has(h));
const stale = [...declared].filter((h) => !actual.has(h));
if (actual.size === 0) fail('index.html 找不到可執行的行內 <script>');
else if (missing.length || stale.length) {
  if (missing.length) fail('_headers script-src 缺少 ' + missing.join(' '));
  if (stale.length) fail('_headers script-src 殘留 ' + stale.join(' '));
} else {
  pass(`CSP script-src 與 ${actual.size} 段行內 script 一致`);
}

// Pharmacy route: local modules and a separate CSP, without weakening the portal.
const pharmacy = path.join(PUB, 'pharmacy');
try {
  const page = fs.readFileSync(path.join(pharmacy, 'index.html'), 'utf8');
  const scripts = [...page.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
  if (scripts.length !== 1 || !/\btype\s*=\s*["']module["']/i.test(scripts[0]?.[1] || '')) fail('pharmacy needs one external module entry');
  for (const match of page.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc=["']\.\/main\.js["']/.test(match[1]) || match[2].trim()) fail('pharmacy inline or non-local script');
  }
  if (/type=["']importmap/.test(page)) fail('pharmacy import maps are forbidden');
  // 以實際生效的標頭驗證：未先 `! Content-Security-Policy` 時會疊成 2 條而 fail
  for (const route of ['/pharmacy/', '/pharmacy/main.js']) {
    const script = (checkPolicy(route, route)?.get('script-src') || []).join(' ');
    if (script !== "'self'") fail(`${route} CSP script-src 應恰為 'self'，實際「${script}」`);
  }
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { scan(file); continue; }
      if (!/\.(js|html)$/.test(file)) continue;
      const source = fs.readFileSync(file, 'utf8');
      if (/<script[^>]+src=["']https?:/i.test(source) || /(?:from\s*|import\s*\(?\s*)["']https?:/i.test(source)) fail('external JS in ' + file);
      if (entry.name.endsWith('.js') && !file.includes(path.sep + 'vendor' + path.sep)) {
        for (const match of source.matchAll(/(?:from\s*|import\s*\(?\s*)["']([^"']+)["']/g)) {
          if (!match[1].startsWith('./')) fail('non-relative pharmacy module ' + match[1]);
          if (!fs.existsSync(path.resolve(path.dirname(file), match[1]))) fail('missing pharmacy module ' + match[1]);
        }
      }
    }
  }
  scan(pharmacy);
  const world = fs.readFileSync(path.join(pharmacy, 'world.js'), 'utf8');
  if (!world.includes("from './vendor/three-lite.js'")) fail('world must use local Three vendor');
  if (/pharmacy|three-lite/.test(fs.readFileSync(path.join(PUB, 'sw.js'), 'utf8').match(/const SHELL = \[[\s\S]*?\];/)[0])) fail('3D must not be precached');
  if (!failures) pass('pharmacy route, local modules, CSP isolation and SW shell');
} catch (error) { fail('pharmacy checks: ' + error.message); }
// ── 4) SW SHELL：每項都要存在（cache.addAll 任一 404 → SW 安裝失敗、離線失效），
//       且不得含 index.html（線上 307 → /，redirected response 會使導覽失敗）
try {
  const sw = fs.readFileSync(path.join(PUB, 'sw.js'), 'utf8');
  const block = (sw.match(/const SHELL = \[([\s\S]*?)\];/) || [])[1];
  if (block == null) throw new Error('找不到 const SHELL = [...]');
  const shell = [...block.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const before = failures;
  if (!shell.includes('./')) fail("sw.js SHELL 缺少入口 './'");
  for (const entry of shell) {
    if (/(^|\/)index\.html$/.test(entry)) fail(`sw.js SHELL 不得含 ${entry}（以 './' 為 cache key）`);
    const file = path.join(PUB, entry === './' ? 'index.html' : entry);
    if (!file.startsWith(PUB + path.sep) || !fs.existsSync(file)) fail(`sw.js SHELL 項目不存在於 public/：${entry}`);
  }
  if (failures === before) pass(`sw.js SHELL ${shell.length} 項皆存在且不含 index.html`);
} catch (e) { fail('sw.js SHELL 檢查：' + e.message); }

process.exit(failures ? 1 : 0);
