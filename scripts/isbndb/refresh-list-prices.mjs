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

// The stalest books with a real ISBN-13. Sidelines (stickers, totes) carry
// UPCs and internal SKUs, which ISBNdb doesn't know.
const books = [];
for (let offset = 0; books.length < budget; offset += 1000) {
  const page = await supabase(
    `books?select=id,isbn,title,price,list_price&isbn=match.${encodeURIComponent('^97[89][0-9]{10}$')}` +
      `&order=list_price_checked_at.asc.nullsfirst,id.asc&offset=${offset}&limit=${Math.min(1000, budget - books.length)}`,
  );
  books.push(...page);
  if (page.length < 1000) break;
}
console.log(`${books.length} books queued`);

const changes = [];
let checked = 0, priced = 0, stopped = null;

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

  const updates = batch.map(b => ({ id: b.id, price: msrp.get(b.isbn) ?? null }));
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

const up = changes.filter(c => Number(c.change) > 0);
await summary([
  `### List prices${dryRun ? ' (dry run - nothing written)' : ''}`,
  `Checked **${checked}** books, **${priced}** had a list price in ISBNdb${stopped ? ` - stopped early: ${stopped}` : ''}.`,
  `**${changes.length}** changed: ${up.length} up, ${changes.length - up.length} down. Full list in \`price-changes.csv\`.`,
  ...(up.length ? ['', '| Book | Was | Now |', '|---|---|---|', ...up.slice(0, 15).map(c => `| ${c.title} | $${c.before} | $${c.after} |`)] : []),
].join('\n'));
