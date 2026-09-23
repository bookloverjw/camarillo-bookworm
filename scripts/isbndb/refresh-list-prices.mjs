#!/usr/bin/env node
/**
 * Refresh publisher list prices from ISBNdb into books.list_price.
 *
 * Publishers have been repricing about quarterly, and the POS export the
 * catalogue came from is months old. This checks the books whose list price
 * was checked longest ago (never-checked first), as many as today's ISBNdb
 * allowance comfortably covers, so the whole catalogue cycles through over
 * a week or two whatever the plan.
 *
 * It writes list_price, never price: price is what the POS says we charge
 * on the shelf. It also writes price-changes.csv, so shelf copies of books
 * that went up can be re-stickered.
 *
 *   node scripts/isbndb/refresh-list-prices.mjs --dry-run      # look, don't write
 *   node scripts/isbndb/refresh-list-prices.mjs --max=500      # cap this run
 *
 * Options: --dry-run, --max=N, --batch=N (ISBNs per request; 100 on Basic,
 * 1000 on Pro and up), --share=0.8 (fraction of today's remaining calls).
 */
import { writeFile } from 'node:fs/promises';
import { requireEnv, flag, option, isbndb, callsLeftToday, supabase, summary, QuotaExhausted, sleep } from './lib.mjs';

requireEnv('ISBNDB_API_KEY');
if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) requireEnv('SUPABASE_SECRET_KEY');

const dryRun = flag('dry-run');
const batchSize = Number(option('batch', 100));
const share = Number(option('share', 0.8));
const hardCap = Number(option('max', 0)) || Infinity;

const { plan, left, total } = await callsLeftToday();
// Each ISBN in a batch costs one call. Leave headroom for Coming Soon and
// anything else sharing the key.
const budget = Math.min(Math.floor(left * share), hardCap);
console.log(`ISBNdb plan: ${plan}, ${left} of ${total} calls left today -> checking up to ${budget} books${dryRun ? ' (dry run)' : ''}`);
if (budget < 1) {
  await summary('### List prices\nNo ISBNdb calls left today; nothing checked.');
  process.exit(0);
}

// Books with a real ISBN-13 (sidelines carry UPCs and internal SKUs, which
// ISBNdb doesn't know): first any with no price at all - the books the site
// shows and the nightly web catalogue import adds come in without one - then
// the stalest.
const ISBN13 = `isbn=match.${encodeURIComponent('^97[89][0-9]{10}$')}`;
const books = [];
const seen = new Set();
for (const filter of ['price=eq.0&list_price=is.null&list_price_checked_at=is.null', '']) {
  for (let offset = 0; books.length < budget; offset += 1000) {
    const page = await supabase(
      `books?select=id,isbn,title,price,list_price,publication_date&${ISBN13}${filter ? `&${filter}` : ''}` +
        `&order=list_price_checked_at.asc.nullsfirst,id.asc&offset=${offset}&limit=1000`,
    );
    for (const b of page) {
      if (books.length < budget && !seen.has(b.id)) { seen.add(b.id); books.push(b); }
    }
    if (page.length < 1000) break;
  }
}
console.log(`${books.length} books queued`);

const changes = [];
const held = [];
const outOfPrint = [];
let bookshopChecks = 0;
let kept = 0; // ISBNdb disagreed, Bookshop.org confirmed our price
// About one Bookshop.org page a second; enough for a night's price changes.
const MAX_BOOKSHOP_CHECKS = 1500;

/** Bookshop.org's listing for an ISBN: in stock (with its price), out of stock, not listed, or unreachable. */
async function bookshopListing(isbn) {
  try {
    const r = await fetch(`https://bookshop.org/book/${isbn}`, {
      headers: { 'User-Agent': 'CamarilloBookworm/1.0 (www.camarillobookworm.com; affiliate price check)' },
      redirect: 'follow', signal: AbortSignal.timeout(20000),
    });
    if (r.status === 404) return { status: 'not-listed' };
    if (!r.ok) return { status: 'error' };
    const html = await r.text();
    const availability = html.match(/"availability"\s*:\s*"https?:\/\/schema\.org\/(\w+)"/)?.[1];
    const price = Number(html.match(/"price"\s*:\s*"?([\d.]+)/)?.[1]);
    if (!availability) return { status: 'not-listed' };
    return { status: availability === 'InStock' ? 'in-stock' : 'out-of-stock', price: price > 0 ? price : null };
  } catch {
    return { status: 'error' };
  }
}
let checked = 0, priced = 0, stopped = null;
const today = new Date().toISOString().slice(0, 10);

for (let i = 0; i < books.length; i += batchSize) {
  const batch = books.slice(i, i + batchSize);
  let found;
  try {
    found = await isbndb('/books', { method: 'POST', body: { isbns: batch.map(b => b.isbn) } });
  } catch (error) {
    if (error instanceof QuotaExhausted) { stopped = 'daily allowance reached'; break; }
    throw error;
  }

  const msrp = new Map();
  for (const book of found?.data ?? []) {
    const price = Number(book.msrp);
    // ISBNdb sometimes carries a zero or a stray non-USD figure; ignore the
    // implausible rather than write it over a real price.
    if (price > 0 && price < 1000) msrp.set(book.isbn13, Math.round(price * 100) / 100);
  }

  // Only books in print matter, and ISBNdb doesn't say which those are - or
  // always get the price right ($1.99 for a $25 hardcover). So before a price
  // changes, ask Bookshop.org, where the site sends buyers: not listed or out
  // of stock means out of print, and the price is left alone; in stock, the
  // new price is written only if it agrees with Bookshop's (which sells at up
  // to ~15% off list). Anything else is held for review.
  const deferred = new Set();
  for (const b of batch) {
    const now = msrp.get(b.isbn);
    const before = Number(b.list_price ?? b.price) || 0;
    if (now == null || Math.abs(now - before) < 0.01) continue;
    // A book that isn't out yet can't be in stock anywhere, so Bookshop.org
    // has nothing to say about it and "out of stock" wouldn't mean out of
    // print. Take the publisher's price as ISBNdb gives it. (Preorders reach
    // the catalogue through the nightly web catalogue import.)
    if ((b.publication_date ?? '') > today) continue;
    if (bookshopChecks >= MAX_BOOKSHOP_CHECKS) { deferred.add(b.id); msrp.delete(b.isbn); continue; }
    bookshopChecks++;
    const shop = await bookshopListing(b.isbn);
    await sleep(1100); // one page a second
    if (shop.status === 'error') { deferred.add(b.id); msrp.delete(b.isbn); continue; }
    if (shop.status !== 'in-stock') {
      outOfPrint.push({ isbn: b.isbn, title: b.title, current: before.toFixed(2), isbndb: now.toFixed(2), bookshop: shop.status });
      msrp.delete(b.isbn);
      continue;
    }
    const fits = price => shop.price != null && price >= shop.price * 0.98 && price <= shop.price / 0.85;
    if (!fits(now)) {
      msrp.delete(b.isbn);
      // Bookshop.org backs the price we already have: ISBNdb is simply wrong.
      if (fits(before)) { kept++; continue; }
      held.push({ isbn: b.isbn, title: b.title, before: before.toFixed(2), isbndb: now.toFixed(2),
                  bookshop: shop.price != null ? shop.price.toFixed(2) : '' });
    }
  }

  const updates = batch.filter(b => !deferred.has(b.id)).map(b => ({ id: b.id, price: msrp.get(b.isbn) ?? null }));
  for (const b of batch) {
    const now = msrp.get(b.isbn);
    const before = b.list_price ?? b.price;
    if (now != null && before != null && Math.abs(now - Number(before)) >= 0.01) {
      changes.push({ isbn: b.isbn, title: b.title, before: Number(before).toFixed(2), after: now.toFixed(2),
                     change: (now - Number(before)).toFixed(2) });
    }
  }

  if (!dryRun) await supabase('rpc/set_list_prices', { method: 'POST', body: { p_prices: updates } });
  checked += batch.length;
  priced += msrp.size;
  process.stdout.write(`\r  checked ${checked}/${books.length}, ${priced} with a list price, ${changes.length} changed`);
  await sleep(1100); // stay under per-second limits on the smaller plans
}
console.log('');

changes.sort((a, b) => Number(b.change) - Number(a.change));
const csv = ['isbn,title,before,after,change',
  ...changes.map(c => [c.isbn, `"${c.title.replace(/"/g, '""')}"`, c.before, c.after, c.change].join(','))].join('\n');
await writeFile('price-changes.csv', `${csv}\n`);
await writeFile('price-held.csv', ['isbn,title,current,isbndb,bookshop',
  ...held.map(h => [h.isbn, `"${h.title.replace(/"/g, '""')}"`, h.before, h.isbndb, h.bookshop].join(','))].join('\n') + '\n');
await writeFile('out-of-print.csv', ['isbn,title,current,isbndb,bookshop',
  ...outOfPrint.map(o => [o.isbn, `"${o.title.replace(/"/g, '""')}"`, o.current, o.isbndb, o.bookshop].join(','))].join('\n') + '\n');

const up = changes.filter(c => Number(c.change) > 0);
await summary([
  `### List prices${dryRun ? ' (dry run - nothing written)' : ''}`,
  `Checked **${checked}** books, **${priced}** had a list price in ISBNdb${stopped ? ` - stopped early: ${stopped}` : ''}.`,
  `**${changes.length}** changed: ${up.length} up, ${changes.length - up.length} down. Full list in \`price-changes.csv\`.`,
  `**${outOfPrint.length}** out of print (not listed or out of stock at Bookshop.org), price left alone - see \`out-of-print.csv\`.`,
  `**${kept}** kept as they are (ISBNdb's figure was off; Bookshop.org confirmed the current price).`,
  `**${held.length}** held for review (Bookshop.org agrees with neither) - see \`price-held.csv\`.`,
  `${bookshopChecks} Bookshop.org checks${bookshopChecks >= MAX_BOOKSHOP_CHECKS ? ' (the nightly limit; the rest wait for tomorrow)' : ''}.`,
  ...(up.length ? ['', '| Book | Was | Now |', '|---|---|---|', ...up.slice(0, 15).map(c => `| ${c.title} | $${c.before} | $${c.after} |`)] : []),
].join('\n'));
