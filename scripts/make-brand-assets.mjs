#!/usr/bin/env node
/**
 * Build the site's icon files from the artwork in assets/:
 *   node scripts/make-brand-assets.mjs
 *
 * The glasses mark is black line-art on transparent with see-through lenses,
 * so it always needs a white ground: a white tile for the favicon and app
 * icons, a white pill ("badge") for use on the green header colour.
 *
 *   public/favicon.png            64px   browser tab
 *   public/apple-touch-icon.png   180px  iOS home screen
 *   public/icon-512.png           512px  Android / social avatars
 *   public/brand/glasses.png      600px wide, transparent - for light backgrounds
 *   public/brand/glasses-badge.png 2x, white pill - for the green header (emails, share image)
 *   public/og-image.png           1200x630 link-preview image
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const glasses = 'data:image/png;base64,' + readFileSync(new URL('assets/blackandwhite_eyes_only.png', root)).toString('base64');

const browser = await chromium.launch();
async function render(path, width, height, body, { transparent = true, scale = 1 } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.setContent(`<body style="margin:0;width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center">${body}</body>`);
  await page.screenshot({ path: new URL(path, root).pathname, omitBackground: transparent });
  await page.close();
}

const tile = (size) =>
  `<div style="width:${size}px;height:${size}px;border-radius:${size * 0.2}px;background:#fff;display:flex;align-items:center;justify-content:center"><img src="${glasses}" style="width:92%"></div>`;

await render('public/favicon.png', 64, 64, tile(64));
await render('public/apple-touch-icon.png', 180, 180, `<div style="width:180px;height:180px;background:#fff;display:flex;align-items:center;justify-content:center"><img src="${glasses}" style="width:88%"></div>`, { transparent: false });
await render('public/icon-512.png', 512, 512, tile(512));
await render('public/brand/glasses.png', 600, 290, `<img src="${glasses}" style="width:100%">`);
await render('public/brand/glasses-badge.png', 150, 84, `<div style="width:150px;height:84px;box-sizing:border-box;border-radius:42px;background:#fff;display:flex;align-items:center;justify-content:center"><img src="${glasses}" style="width:80%"></div>`, { scale: 2 });

// Link-preview image (Facebook, iMessage, Slack...)
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;600&family=Italianno&display=swap" rel="stylesheet">
<style>body{margin:0;width:1200px;height:630px;background:#1B4332;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 96px;box-sizing:border-box;font-family:'Crimson Pro',serif;position:relative}
.k{font-family:Inter;letter-spacing:.22em;text-transform:uppercase;font-size:22px;color:#B7E4C7;font-weight:600}
h1{font-size:118px;line-height:1;margin:18px 0 26px;font-weight:400;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
h1 i{font-family:Italianno;font-style:normal;text-transform:none;letter-spacing:0;font-size:150px;margin-right:18px}
p{font-size:40px;font-style:italic;margin:0;color:#D8F3DC}
.f{position:absolute;bottom:60px;left:96px;font-family:Inter;font-size:24px;color:#B7E4C7}
.bar{position:absolute;top:0;left:0;width:100%;height:14px;background:#B7E4C7}
.badge{position:absolute;bottom:56px;right:90px;width:240px;height:134px;box-sizing:border-box;border-radius:67px;background:#fff;display:flex;align-items:center;justify-content:center}
.badge img{width:80%}</style></head>
<body><div class="bar"></div><div class="badge"><img src="${glasses}"></div>
<div class="k">Camarillo's independent bookstore · Since 1973</div><h1><i>The</i>Bookworm</h1>
<p>New releases, staff picks, author events &amp; book clubs</p>
<div class="f">93 E Daily Dr, Camarillo, CA · camarillobookworm.com</div></body></html>`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: new URL('public/og-image.png', root).pathname });
  await page.close();
}

await browser.close();
console.log('brand assets written');
