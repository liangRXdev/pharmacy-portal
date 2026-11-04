/* check-cache-bump.js — shell 檔有變動時，public/sw.js 的 CACHE 必須升版
 *
 * 用法：node tools/check-cache-bump.js <base-commit>
 *
 * shell 檔清單直接取自 HEAD 的 sw.js SHELL（'./' 對應 public/index.html），
 * 不在 workflow 寫死路徑——SHELL 增減檔案時規則自動跟著走。
 */
'use strict';
const { execFileSync } = require('child_process');

const base = process.argv[2];
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

function exists(rev) {
  try { git('cat-file', '-e', `${rev}^{commit}`); return true; } catch { return false; }
}
if (!base || /^0+$/.test(base) || !exists(base)) {
  console.log(`無可比對的 base（${base || '未提供'}），略過`);
  process.exit(0);
}

function show(rev, file) {
  try { return git('show', `${rev}:${file}`); } catch { return null; }
}
const cacheOf = (src) => ((src || '').match(/^const CACHE = .*$/m) || [])[0] || null;
const swHead = show('HEAD', 'public/sw.js');
const block = ((swHead || '').match(/const SHELL = \[([\s\S]*?)\];/) || [])[1];
if (block == null) { console.error('::error file=public/sw.js::找不到 const SHELL = [...]'); process.exit(1); }

const shell = [...block.matchAll(/['"]([^'"]+)['"]/g)]
  .map((m) => 'public/' + (m[1] === './' ? 'index.html' : m[1].replace(/^\.\//, '')));
const changed = git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean);
const touched = changed.filter((f) => shell.includes(f));
if (!touched.length) { console.log('shell 檔未變動'); process.exit(0); }

const before = cacheOf(show(base, 'public/sw.js') ?? show(base, 'sw.js'));
const after = cacheOf(swHead);
console.log('shell 變動：' + touched.join(', '));
console.log('CACHE base: ' + before);
console.log('CACHE head: ' + after);
if (!after || before === after) {
  console.error('::error file=public/sw.js::shell 檔有變動但 sw.js 的 CACHE 版本未升');
  process.exit(1);
}
