/* check-portal.js — 部署前不變量檢查（CI 與本機共用）
 *
 * 用法：node tools/check-portal.js
 *
 * 檢查：
 *   1) public/tools.json 可 JSON.parse，且每個工具的 category 都存在於 categories
 *   2) public/index.html 每段可執行的行內 <script> 之 sha256，與 public/_headers
 *      CSP script-src 的 hash 集合完全一致（缺 → JS 被擋；多 → 殘留舊 hash）
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
const csp = headers.split('\n').find((l) => /^\s*Content-Security-Policy:/i.test(l)) || '';
const scriptSrc = (csp.match(/script-src([^;]*)/) || [])[1] || '';
const declared = new Set(scriptSrc.trim().split(/\s+/).filter((s) => s.startsWith("'sha256-")));

const missing = [...actual].filter((h) => !declared.has(h));
const stale = [...declared].filter((h) => !actual.has(h));
if (actual.size === 0) fail('index.html 找不到可執行的行內 <script>');
else if (missing.length || stale.length) {
  if (missing.length) fail('_headers script-src 缺少 ' + missing.join(' '));
  if (stale.length) fail('_headers script-src 殘留 ' + stale.join(' '));
} else {
  pass(`CSP script-src 與 ${actual.size} 段行內 script 一致`);
}

process.exit(failures ? 1 : 0);
