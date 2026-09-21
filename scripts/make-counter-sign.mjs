#!/usr/bin/env node
/**
 * Make the printable newsletter sign for the counter:
 *   node scripts/make-counter-sign.mjs [src]
 *
 * Writes marketing/newsletter-sign-<src>.pdf (US Letter). The QR code points
 * at /newsletter?src=<src>, so signups are recorded with where they came from:
 * "store" (the default) for the register, "event" for a table at an event.
 */
import QRCode from 'qrcode';
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';

const src = (process.argv[2] ?? 'store').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'store';
const url = `https://www.camarillobookworm.com/newsletter?src=${src}`;
const out = new URL(`../marketing/newsletter-sign-${src}.pdf`, import.meta.url);

const glasses = 'data:image/png;base64,' + (await readFile(new URL('../assets/blackandwhite_eyes_only.png', import.meta.url))).toString('base64');
const qr = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'Q', margin: 0, color: { dark: '#1B4332', light: '#ffffff' } });

const html = `<!DOCTYPE html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  @page { size: Letter; margin: 0 }
  body { margin: 0; width: 8.5in; height: 11in; box-sizing: border-box; font-family: 'Crimson Pro', serif; color: #1a1a1a; text-align: center; display: flex; flex-direction: column }
  header { background: #1B4332; color: #fff; padding: .55in .75in .55in }
  .badge { width: 1.7in; height: .95in; border-radius: .5in; background: #fff; margin: 0 auto .25in; display: flex; align-items: center; justify-content: center }
  .badge img { width: 80% }
  .kicker { font-family: Inter, sans-serif; font-size: 13pt; letter-spacing: .22em; text-transform: uppercase; color: #B7E4C7; font-weight: 600 }
  h1 { font-size: 64pt; line-height: 1; margin: .2in 0 0; font-weight: 700 }
  main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 1in }
  .lead { font-size: 25pt; line-height: 1.25; margin: 0 0 .45in }
  .qr { width: 3.1in; height: 3.1in; padding: .22in; border: 3pt solid #1B4332; border-radius: .2in }
  .qr svg { width: 100%; height: 100%; display: block }
  .how { font-family: Inter, sans-serif; font-size: 14pt; margin: .3in 0 0; color: #333 }
  .how b { color: #1B4332 }
  footer { padding: 0 1in .6in; font-family: Inter, sans-serif; font-size: 11pt; color: #555 }
  footer i { font-family: 'Crimson Pro', serif; font-size: 17pt; color: #1B4332; display: block; margin-bottom: .12in }
</style></head><body>
  <header><div class="badge"><img src="${glasses}" alt=""></div><div class="kicker">The Bookworm · Camarillo · Since 1973</div><h1>Be first to hear</h1></header>
  <main>
    <p class="lead">Author events, signings &amp; book clubs,<br>plus the week's new books -<br>in one short email.</p>
    <div class="qr">${qr}</div>
    <p class="how"><b>Point your phone's camera here</b> to join our newsletter</p>
  </main>
  <footer><i>Or just ask us - we're happy to sign you up.</i>camarillobookworm.com/newsletter · No spam, ever. Unsubscribe with one click.</footer>
</body></html>`;

await mkdir(new URL('../marketing/', import.meta.url), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: out.pathname, format: 'Letter', printBackground: true });
await page.screenshot({ path: out.pathname.replace(/\.pdf$/, '.png'), clip: { x: 0, y: 0, width: 816, height: 1056 } });
await browser.close();
console.log(`${out.pathname}\n-> ${url}`);
