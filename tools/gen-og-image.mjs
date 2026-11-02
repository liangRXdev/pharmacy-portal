#!/usr/bin/env node
// 由 tools/og-image.html 產生 public/og-image.png（1200×630）。需連網載入 Noto Sans TC。
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = pathToFileURL(path.join(root, 'tools', 'og-image.html')).href;
const output = path.join(root, 'public', 'og-image.png');

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(source, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const fontLoaded = await page.evaluate(() => document.fonts.check('700 80px "Noto Sans TC"', '藥學工具'));
  if (!fontLoaded) throw new Error('Noto Sans TC 未載入，拒絕用備援字型輸出');
  await page.screenshot({ path: output, type: 'png' });
  console.log('wrote ' + output);
} finally {
  await browser.close();
}
