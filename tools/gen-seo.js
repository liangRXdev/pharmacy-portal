/* gen-seo.js — 由 tools.json 產生 SEO/GEO 靜態內容
 *
 * 產出：
 *   1) sitemap.xml（入口頁，lastmod 取自 tools.json meta.lastUpdated）
 *   2) index.html 內 <!-- SEO-JSONLD:START --> … <!-- SEO-JSONLD:END --> 之間的
 *      JSON-LD（WebSite + Person + ItemList 15 工具）
 *
 * 用法：新增/修改 tools.json 後執行 `node tools/gen-seo.js`，再 commit、push。
 * 注意：本腳本只改動 JSON-LD 標記區間（type="application/ld+json"，CSP 不管 data block），
 *       不會碰既有可執行 <script>，故毋須重算 _headers 的 CSP sha256 hash。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://pharmacy-portal.liangrxdev.workers.dev/';
const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools.json'), 'utf8'));

// ── JSON-LD ──
const items = d.tools.map((t, i) => {
  const item = {
    '@type': 'WebApplication',
    name: t.nameZh,
    alternateName: t.name,
    applicationCategory: 'MedicalApplication',
    operatingSystem: 'Web',
    isAccessibleForFree: true,
    description: t.description,
  };
  if (t.url) item.url = t.url;
  return { '@type': 'ListItem', position: i + 1, item };
});

const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': BASE + '#website',
      url: BASE,
      name: '個人臨床藥學工具集',
      alternateName: 'Clinical Pharmacy Toolkit',
      inLanguage: 'zh-TW',
      description: '臨床藥師梁哲嘉開發的免費線上臨床藥學工具集，彙整藥物劑量計算、實證醫學（EBM）計算、藥物安全（ADR）分析、TFDA 藥品資料庫查詢與院內輔助工具。',
      author: { '@id': BASE + '#person' },
      publisher: { '@id': BASE + '#person' },
    },
    {
      '@type': 'Person',
      '@id': BASE + '#person',
      name: '梁哲嘉',
      alternateName: '梁哲嘉藥師',
      jobTitle: '臨床藥師',
      description: '臨床藥師、實證醫學（EBM）專家、醫療輔助系統開發者',
      knowsAbout: ['臨床藥學', '實證醫學', '藥物安全監視', '藥物動力學', '藥事資訊'],
    },
    {
      '@type': 'ItemList',
      name: '臨床藥學工具清單',
      numberOfItems: d.tools.length,
      itemListOrder: 'https://schema.org/ItemListUnordered',
      itemListElement: items,
    },
  ],
};

// 以 </script> 防護後注入（避免 JSON 內若含字串提早關閉 script）
const jsonld = JSON.stringify(graph).replace(/<\/script>/gi, '<\\/script>');
const block =
  '<!-- SEO-JSONLD:START（由 tools/gen-seo.js 產生，勿手改）-->\n' +
  '  <script type="application/ld+json">' + jsonld + '</script>\n' +
  '  <!-- SEO-JSONLD:END -->';

const idxPath = path.join(ROOT, 'index.html');
let html = fs.readFileSync(idxPath, 'utf8');
const re = /<!-- SEO-JSONLD:START[\s\S]*?<!-- SEO-JSONLD:END -->/;
if (!re.test(html)) {
  throw new Error('index.html 找不到 SEO-JSONLD 標記區間，請先放入 START/END 註解');
}
html = html.replace(re, block);
fs.writeFileSync(idxPath, html);

// ── sitemap.xml（只列同網域入口頁）──
const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  '  <url>\n' +
  '    <loc>' + BASE + '</loc>\n' +
  '    <lastmod>' + d.meta.lastUpdated + '</lastmod>\n' +
  '    <changefreq>monthly</changefreq>\n' +
  '    <priority>1.0</priority>\n' +
  '  </url>\n' +
  '</urlset>\n';
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);

console.log('✓ JSON-LD 已注入 index.html（' + d.tools.length + ' 工具，' +
  d.tools.filter((t) => t.url).length + ' 個有公開 URL）');
console.log('✓ sitemap.xml 已產生（lastmod ' + d.meta.lastUpdated + '）');
