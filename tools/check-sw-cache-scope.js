/* check-sw-cache-scope.js — origin 級檢查：沒有一個工具的 SW 會刪掉鄰居的快取
 *
 * 用法：node tools/check-sw-cache-scope.js
 *
 * ## 為什麼需要這支腳本
 *
 * CacheStorage 是**整個 origin 共用**的。liangrxdev.github.io 上住著十幾個工具，
 * 任何一支 SW 在 activate 寫成 `keys.filter(k => k !== CACHE)`，都會在自己更新時
 * 把鄰居的離線快取一起刪光——鄰居的 SW 沒做錯任何事，也沒有任何測試會紅。
 * 每個 repo 的測試都只看得見自己，這個不變量只有跨 repo 掃描守得住。
 *
 * ## 檢查方式
 *
 * 不比對原始碼字串（`startsWith` 可以寫對卻用錯常數）。真的把每份 sw.js 載進
 * 受控的假 SW 全域、驅動它的 activate，記錄它實際呼叫 caches.delete 刪了誰：
 *
 *   1. 先驅動 install，取證每支 SW **實際開啟**的 cache 名稱 → 那就是它的地盤
 *   2. 把所有工具的地盤 ＋ 一個外來哨兵餵給每支 SW 的 activate
 *   3. 誰刪了不屬於自己的名稱，就是誰有問題
 *
 * 哨兵（`__canary-not-mine-…`）不屬於任何工具，且不含 workbox 的 `-precache-`
 * 標記。有前綴守衛的 SW 一定不碰它；沒守衛的 SW 一定刪它（因為它 `!== CACHE`）。
 * 所以這組斷言不會恆真——不必為了證明這件事去改各 repo 的原始碼。
 *
 * ## 前提
 *
 * 各 repo 平鋪在同一層（`C:\Users\liang\projects\<repo>`）。掃不到就當場報錯，
 * 不靜默略過——「沒掃到」與「掃過且乾淨」必須長得不一樣。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PROJECTS = path.join(__dirname, '..', '..');
const CANARY = '__canary-not-mine-do-not-delete__';
const ORIGIN = 'https://liangrxdev.github.io';

/** 找出同層每個 repo 的 SW（含 Vite/workbox 產物放在 dist/ 的） */
function discover() {
  const found = [];
  for (const entry of fs.readdirSync(PROJECTS, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    for (const rel of ['sw.js', path.join('dist', 'sw.js'), path.join('dist', 'service-worker.js')]) {
      const file = path.join(PROJECTS, entry.name, rel);
      if (fs.existsSync(file)) found.push({ repo: entry.name, rel, file });
    }
  }
  return found;
}

/** 把一份 sw.js 載進假 SW 全域；回傳它的 listeners 與觀測到的痕跡 */
function loadSw(src, existingCaches) {
  const opened = [];
  const deleted = [];
  const listeners = {};

  const cacheStub = {
    addAll: async () => {},
    put: async () => {},
    match: async () => undefined,
    keys: async () => [],
    delete: async () => true,
  };
  const caches = {
    open: async (name) => { opened.push(name); return cacheStub; },
    keys: async () => existingCaches.slice(),
    delete: async (k) => { deleted.push(k); return true; },
    match: async () => undefined,
  };
  const selfStub = {
    addEventListener: (k, fn) => { (listeners[k] || (listeners[k] = [])).push(fn); },
    location: { origin: ORIGIN },
    registration: { scope: `${ORIGIN}/tool/` },
    skipWaiting: () => {},
    clients: { claim: () => {} },
    importScripts: () => { throw new Error('importScripts'); },
  };
  const fetchStub = async () => ({ ok: true, clone: () => ({ ok: true }) });

  // sw.js 是 classic script，不能 import；在受控 scope 執行
  const fn = new Function(
    'self', 'caches', 'fetch', 'URL', 'Error', 'importScripts', 'location', 'console',
    src,
  );
  fn(selfStub, caches, fetchStub, URL, Error, selfStub.importScripts, selfStub.location, console);
  return { listeners, opened, deleted };
}

async function drive(listeners, name) {
  const pending = [];
  const event = { waitUntil: (p) => pending.push(p) };
  for (const fn of listeners[name] || []) fn(event);
  await Promise.all(pending);
}

async function main() {
  const targets = discover();
  if (targets.length === 0) {
    console.error(`找不到任何 sw.js——預期各 repo 平鋪在 ${PROJECTS}`);
    process.exit(2);
  }

  // ── 第一趟：取證每支 SW 的地盤（install 實際開啟的 cache 名稱）──
  const territory = new Map();   // repo -> string[]
  const skipped = [];
  for (const t of targets) {
    const src = fs.readFileSync(t.file, 'utf8');
    try {
      const { listeners, opened } = loadSw(src, []);
      await drive(listeners, 'install');
      if (opened.length === 0) {
        // install 沒開 cache（例如純 runtime caching），改由 activate 那趟觀測
        territory.set(t.repo, []);
      } else {
        territory.set(t.repo, [...new Set(opened)]);
      }
    } catch (e) {
      skipped.push({ repo: t.repo, rel: t.rel, why: e.message });
    }
  }

  const owners = new Map();      // cache 名稱 -> repo
  for (const [repo, names] of territory) {
    for (const n of names) {
      if (owners.has(n) && owners.get(n) !== repo) {
        console.error(`FAIL  cache 名稱撞名：'${n}' 同時被 ${owners.get(n)} 與 ${repo} 使用`);
        process.exitCode = 1;
      }
      owners.set(n, repo);
    }
  }

  // ── 第二趟：餵所有人的地盤 ＋ 哨兵，看誰刪了不屬於自己的 ──
  const allNames = [...owners.keys(), CANARY];
  let failures = 0;

  for (const t of targets) {
    if (skipped.some((s) => s.repo === t.repo && s.rel === t.rel)) continue;
    const own = new Set(territory.get(t.repo) || []);
    const src = fs.readFileSync(t.file, 'utf8');

    let deleted;
    try {
      const sw = loadSw(src, allNames);
      await drive(sw.listeners, 'activate');
      deleted = sw.deleted;
    } catch (e) {
      console.error(`FAIL  ${t.repo}：activate 執行失敗 — ${e.message}`);
      failures += 1;
      continue;
    }

    const trespass = deleted.filter((k) => !own.has(k));
    if (trespass.length) {
      failures += 1;
      const victims = trespass.map((k) => (k === CANARY ? '哨兵' : owners.get(k) || '?'));
      console.error(
        `FAIL  ${t.repo}\n` +
        `      activate 刪了不屬於自己的 cache：${JSON.stringify(trespass)}\n` +
        `      受害者：${[...new Set(victims)].join('、')}\n` +
        '      修法：activate 的 filter 加上前綴守衛 — k.startsWith(PREFIX) && k !== CACHE',
      );
    } else {
      console.log(`PASS  ${t.repo.padEnd(30)} 地盤 ${JSON.stringify([...own])}`);
    }
  }

  for (const s of skipped) {
    console.log(`SKIP  ${s.repo.padEnd(30)} ${s.rel} 無法在假全域載入（${s.why}）`);
  }

  if (skipped.length) {
    console.log(
      '\n註：SKIP 不等於通過。多半是 workbox 產物（importScripts／打包後的 runtime），\n' +
      '    那類 SW 的 cleanupOutdatedCaches 以 registration.scope 篩選，天生不會跨工具刪，\n' +
      '    但新出現的 SKIP 要當場看一眼再決定。',
    );
  }

  console.log(
    failures
      ? `\n${failures} 個工具的 SW 會刪到鄰居的快取`
      : `\n全部通過：${targets.length - skipped.length} 個 SW，沒有一個越界`,
  );
  process.exit(failures ? 1 : (process.exitCode || 0));
}

main().catch((e) => { console.error(e); process.exit(2); });
