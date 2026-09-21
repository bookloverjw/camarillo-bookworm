#!/usr/bin/env node
/**
 * Build the homepage's Coming Soon from forthcoming books by authors readers
 * already want: those on this week's NYT lists and recent prize winners.
 *
 * The catalogue can't do this - it stopped syncing from the POS in February,
 * so it holds almost no future titles. Publishers feed ISBNdb months ahead,
 * and its author search can ask for just the books not out yet.
 *
 *   node scripts/isbndb/refresh-coming-soon.mjs --dry-run
 *
 * Options: --dry-run, --months=6 (how far ahead), --max-authors=120.
 */
import { readFile } from 'node:fs/promises';
import { requireEnv, flag, option, isbndb, callsLeftToday, supabase, summary, QuotaExhausted, sleep } from './lib.mjs';

requireEnv('ISBNDB_API_KEY');
if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) requireEnv('SUPABASE_SECRET_KEY');

const dryRun = flag('dry-run');
const months = Number(option('months', 6));
const maxAuthors = Number(option('max-authors', 120));
const SITE = 'https://www.camarillobookworm.com';

const iso = d => d.toISOString().slice(0, 10);
const today = new Date();
const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const horizon = new Date(today); horizon.setUTCMonth(horizon.getUTCMonth() + months);
const runStarted = new Date().toISOString();

const fold = s => (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\(.*$/, '').split(':')[0].replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/^(the|a|an) /, '');

// ---- who to look for ------------------------------------------------------
const authors = new Map(); // name -> reason
const add = (name, reason) => {
  const clean = (name || '').split(/,| and | with /i)[0].replace(/\s+/g, ' ').trim();
  if (clean.length > 3 && !authors.has(clean)) authors.set(clean, reason);
};

// This week's NYT lists, as the site already assembles them (no NYT key needed here).
try {
  const lists = await (await fetch(`${SITE}/api/homepage-books`)).json();
  for (const shelf of Object.values(lists.bestsellers ?? {})) {
    for (const b of shelf) add(b.author, "New from an author on this week's NYT best seller list");
  }
} catch (e) {
  console.warn(`Couldn't read the NYT lists from ${SITE}: ${e.message}`);
}

// Winners of the last two years' prizes.
const awards = JSON.parse(await readFile(new URL('../../public/collections/awards.json', import.meta.url)));
const awardName = new Map(awards.awards.map(a => [a.id, a.name]));
const latest = Math.max(...awards.results.map(r => r.year));
for (const r of awards.results) {
  if (r.result === 'winner' && r.year >= latest - 1) add(r.book.author, `New from a ${r.year} ${awardName.get(r.award)} winner`);
}

const queue = [...authors].slice(0, maxAuthors);
const { left } = await callsLeftToday();
console.log(`${authors.size} authors; looking up ${Math.min(queue.length, left)} (${left} ISBNdb calls left today)${dryRun ? ' - dry run' : ''}`);

// What we already stock, so a new paperback of a book we carry isn't "coming soon".
const carried = new Set();
for (let offset = 0; ; offset += 1000) {
  const page = await supabase(`books?select=title,author&order=id.asc&offset=${offset}&limit=1000`);
  for (const b of page) carried.add(`${fold(b.title)}|${fold(b.author).split(' ').pop()}`);
  if (page.length < 1000) break;
}

// ---- look them up ---------------------------------------------------------
const PRINT = /hardcover|hardback|paperback|trade|board|library binding/i;
const SKIP = /audio|mp3|cd|kindle|ebook|e-book|digital|large print|box set|boxed/i;
const found = new Map(); // title|surname -> best edition

for (const [name, reason] of queue.slice(0, left)) {
  let res;
  try {
    res = await isbndb(`/author/${encodeURIComponent(name)}?publishedFrom=${iso(tomorrow)}&publishedTo=${iso(horizon)}&pageSize=20`);
  } catch (e) {
    if (e instanceof QuotaExhausted) break;
    console.warn(`  ${name}: ${e.message}`);
    continue;
  }
  const surname = fold(name).split(' ').pop();
  for (const b of res?.books ?? []) {
    const date = b.date_published || '';
    if (!/^\d{4}-\d{2}/.test(date)) continue;               // a bare year can't be placed
    if (date <= iso(today)) continue;
    if (b.language && !/^en/i.test(b.language)) continue;
    if (SKIP.test(b.binding || '') || !PRINT.test(b.binding || 'hardcover')) continue;
    if (!(b.authors || []).some(a => fold(a).includes(surname))) continue;
    const key = `${fold(b.title)}|${surname}`;
    if (!fold(b.title) || carried.has(key)) continue;
    const prev = found.get(key);
    // One edition per title: the first one out, hardcover over paperback.
    const better = !prev || date < prev.date || (date === prev.date && /hard/i.test(b.binding) && !/hard/i.test(prev.binding));
    if (better) found.set(key, { isbn: b.isbn13, title: b.title, author: name, date, binding: b.binding,
                                 cover: b.image || null, msrp: Number(b.msrp) > 0 ? Number(b.msrp) : null, reason });
  }
  await sleep(1100);
}

const upcoming = [...found.values()]
  .map(b => ({ ...b, date: b.date.length === 7 ? `${b.date}-01` : b.date.slice(0, 10) }))
  .sort((a, b) => a.date.localeCompare(b.date));

// Link the ones we already have on order (a preorder in the catalogue).
if (upcoming.length) {
  const ids = await supabase(`books?select=id,isbn&isbn=in.(${upcoming.map(b => b.isbn).join(',')})`);
  const byIsbn = new Map(ids.map(r => [r.isbn, r.id]));
  for (const b of upcoming) b.catalogId = byIsbn.get(b.isbn) ?? null;
}

if (!dryRun && upcoming.length) {
  await supabase('upcoming_books?on_conflict=isbn', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: upcoming.map(b => ({
      isbn: b.isbn, title: b.title, author: b.author, publication_date: b.date, cover_url: b.cover,
      msrp: b.msrp, reason: b.reason, catalog_id: b.catalogId, refreshed_at: runStarted,
    })),
  });
  // Anything this run didn't find again - published by now, or cancelled - goes.
  await supabase(`upcoming_books?refreshed_at=lt.${encodeURIComponent(runStarted)}`, { method: 'DELETE' });
}

await summary([
  `### Coming Soon${dryRun ? ' (dry run - nothing written)' : ''}`,
  `Looked up **${Math.min(queue.length, left)}** authors; found **${upcoming.length}** forthcoming books through ${iso(horizon)}.`,
  ...(upcoming.length ? ['', '| Out | Book | Author | Why |', '|---|---|---|---|',
    ...upcoming.slice(0, 20).map(b => `| ${b.date} | ${b.title} | ${b.author} | ${b.reason} |`)] : []),
].join('\n'));
