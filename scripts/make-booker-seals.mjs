#!/usr/bin/env node
/**
 * The Booker Prize has a logo per year rather than a standing seal. Turn the
 * artwork in assets/booker/booker-YYYY.png into 240px square seals
 * (public/awards/booker-YYYY.png) like the other awards', on a white tile so
 * they read on top of any book cover:
 *   node scripts/make-booker-seals.mjs
 * then give that year's results  "seal": "booker-YYYY.png"  in
 * public/collections/awards.json.
 */
import { chromium } from 'playwright';
import { readdir, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dir = new URL('assets/booker/', root);
const BORDERED = new Map([['booker-2021.png', 1.07], ['booker-2022.png', 1.07], ['booker-2023.png', 1.035], ['booker-2024.png', 1.07]]);
const browser = await chromium.launch();
for (const file of (await readdir(dir)).filter(f => /^booker-\d{4}\.png$/.test(f))) {
  const src = 'data:image/png;base64,' + (await readFile(new URL(file, dir))).toString('base64');
  const page = await browser.newPage({ viewport: { width: 240, height: 240 }, deviceScaleFactor: 1 });
  // Some source files carry a hairline border around the artwork; zoom those
  // a little inside a box of the image's own shape so the border is clipped.
  const zoom = BORDERED.get(file) ?? 1;
  await page.setContent(`<body style="margin:0;width:240px;height:240px;display:flex;align-items:center;justify-content:center">
    <div style="width:240px;height:240px;box-sizing:border-box;border-radius:24px;background:#fff;display:flex;align-items:center;justify-content:center">
      <div style="height:204px;overflow:hidden;display:flex"><img src="${src}" style="height:204px;width:auto;transform:scale(${zoom})"></div>
    </div></body>`);
  await page.screenshot({ path: new URL(`public/awards/${file}`, root).pathname, omitBackground: true });
  await page.close();
  console.log(file);
}
await browser.close();
