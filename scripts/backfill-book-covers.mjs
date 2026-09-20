#!/usr/bin/env node
/**
 * Backfill missing book covers into the book-covers storage bucket.
 *
 * Roughly 13,800 of the 22,700 rows in books have no cover_url. The site
 * falls back to Open Library at render time (see src/app/components/
 * BookCover.tsx), which works but leaves half the catalogue's imagery
 * depending on a third party being up. This fetches those covers once,
 * stores them in our own bucket, and points cover_url at them - the same
 * place and naming the existing covers already use.
 *
 * Writing to books and to storage both need the SECRET key - the one under
 * "Secret keys" in the Supabase dashboard (Settings > API), which replaced
 * the old service_role key. The publishable key cannot do this. Pass it via
 * env and NEVER commit it:
 *
 *   read -rs "SUPABASE_SECRET_KEY?secret key: "; export SUPABASE_SECRET_KEY
 *
 * Usage:
 *   # See what would happen, touching nothing (do this first):
 *   node scripts/backfill-book-covers.mjs --dry-run
 *
 *   # Try a small batch for real:
 *   node scripts/backfill-book-covers.mjs --limit=50
 *
 *   # The whole catalogue (expect a couple of hours at the default pacing):
 *   node scripts/backfill-book-covers.mjs
 *
 * Options:
 *   --dry-run        Report what would be fetched and stored; write nothing.
 *   --limit=N        Stop after N books (default: no limit).
 *   --delay=MS       Pause between books (default: 250ms, 1000ms for search).
 *   --overwrite      Re-fetch books that already have a cover_url.
 *   --via=search     Use the search index instead of the covers endpoint. It
 *                    finds covers on other editions of the same work, which
 *                    recovers a good share of what --via=isbn reports as
 *                    missing. Slower, so run it as a second pass.
 *   --order=desc     Walk the catalogue backwards. Lets a search pass run
 *                    beside an isbn pass without the two fighting over rows.
 *
 * Safe to stop and re-run: without --overwrite it only looks at rows whose
 * cover_url is still null, so a second run picks up where the first left off.
 */

const SUPABASE_URL = 'https://lildbdxabljkoynvpflu.supabase.co';
const BUCKET = 'book-covers';

// SUPABASE_SERVICE_ROLE_KEY still works for anyone on a legacy key.
const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SECRET_KEY environment variable.');
  console.error('Both the books update and the storage upload need it.');
  console.error('');
  console.error('Supabase dashboard > Settings > API > Secret keys > default');
  console.error('(click the eye to reveal). It starts with sb_secret_.');
  process.exit(1);
}


const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const overwrite = args.includes('--overwrite');
const limit = Number(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || null;

// 'isbn' asks the covers endpoint for this exact edition. 'search' asks the
// search index, which knows about other editions of the same work and so
// finds covers the first route misses - roughly three in four, by sampling.
const via = args.find(a => a.startsWith('--via='))?.split('=')[1] || 'isbn';
if (!['isbn', 'search'].includes(via)) {
  console.error(`Unknown --via=${via}. Use 'isbn' or 'search'.`);
  process.exit(1);
}

// Descending order lets a search pass run alongside an isbn pass without the
// two racing for the same rows until they meet in the middle.
const descending = args.includes('--order=desc');

// The search index is a heavier endpoint than the cover CDN; go slower on it.
const delayMs =
  Number(args.find(a => a.startsWith('--delay='))?.split('=')[1]) ||
  (via === 'search' ? 1000 : 250);

// The publishable key reads fine, so a real run gets all the way to the first
// upload before storage RLS rejects it - once per book. Catch it up front. A
// dry run only reads, so let that through.
if (!dryRun && SUPABASE_KEY.startsWith('sb_publishable_')) {
  console.error('That is the publishable key - the one already in the browser');
  console.error('bundle. It can read the catalogue but cannot write to the');
  console.error('book-covers bucket.');
  console.error('');
  console.error('Use the secret key instead: Supabase dashboard > Settings >');
  console.error('API > Secret keys > default (click the eye to reveal). It');
  console.error('starts with sb_secret_ and replaced the old service_role key.');
  process.exit(1);
}

// Open Library is a nonprofit serving these for free. default=false makes it
// 404 rather than hand back a blank placeholder we'd otherwise store.
const coverUrlFor = isbn => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;

// Sidelines - stickers, totes, "Misc Charge" - live in the books table under
// UPCs and internal SKUs. There is no cover to find for those.
const isRealBook = isbn => typeof isbn === 'string' && /^97[89]\d{10}$/.test(isbn);

// Open Library sometimes serves a tiny "no cover" GIF instead of 404ing.
// Anything this small is not a real jacket image.
const MIN_COVER_BYTES = 2000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const supabaseHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

/** Page through the books that still need a cover. */
async function fetchBooksNeedingCovers() {
  const books = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const filter = overwrite ? '' : '&cover_url=is.null';
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/books?select=id,isbn,title${filter}` +
        `&order=id.${descending ? 'desc' : 'asc'}&offset=${offset}&limit=${pageSize}`,
      { headers: supabaseHeaders },
    );

    if (!res.ok) {
      throw new Error(`Listing books failed: ${res.status} ${await res.text()}`);
    }

    const page = await res.json();
    books.push(...page);

    if (page.length < pageSize) break;
    if (limit && books.length >= limit) break;
  }

  const usable = books.filter(b => isRealBook(b.isbn));
  return limit ? usable.slice(0, limit) : usable;
}

/**
 * Find a cover through the search index. The covers endpoint only knows the
 * exact edition we ask about; search knows the whole work, so a title whose
 * own printing was never scanned can still borrow another edition's jacket.
 */
async function findCoverIdViaSearch(isbn) {
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${isbn}&fields=title,cover_i,isbn&limit=1`,
  );

  if (!res.ok) {
    if (res.status === 429) await sleep(30000);
    throw new Error(`Open Library search returned ${res.status}`);
  }

  const doc = (await res.json()).docs?.[0];
  if (!doc?.cover_i) return null;

  // Search is fuzzy and will happily return a neighbouring book. Only trust a
  // result that actually lists the ISBN we asked about.
  if (!(doc.isbn || []).includes(isbn)) return null;

  return doc.cover_i;
}

/** Pull one cover. Returns bytes, or null when there isn't a usable one. */
async function fetchCover(isbn) {
  let url = coverUrlFor(isbn);

  if (via === 'search') {
    const coverId = await findCoverIdViaSearch(isbn);
    if (!coverId) return null;
    url = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`;
  }

  const res = await fetch(url, { redirect: 'follow' });

  // 404 is Open Library answering honestly: it has no cover for this ISBN.
  if (res.status === 404) return null;

  // Anything else non-OK is a rate limit or an outage, not an answer about
  // the book. Reporting it as "no cover" would quietly write the title off
  // when a later run would have found one, so surface it as a failure.
  if (!res.ok) {
    if (res.status === 429) await sleep(30000);
    throw new Error(`Open Library returned ${res.status}`);
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < MIN_COVER_BYTES) return null;

  return bytes;
}

async function uploadCover(isbn, bytes) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${isbn}.jpg`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: bytes,
  });

  if (!res.ok) {
    throw new Error(`Upload failed for ${isbn}: ${res.status} ${await res.text()}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${isbn}.jpg`;
}

async function setCoverUrl(id, url) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/books?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...supabaseHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cover_url: url }),
  });

  if (!res.ok) {
    throw new Error(`Updating ${id} failed: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  console.log(
    `${dryRun ? 'Dry run - nothing will be written.' : 'Backfilling covers.'}` +
      ` (via ${via}, ${descending ? 'newest' : 'oldest'} first)\n`,
  );

  const books = await fetchBooksNeedingCovers();
  console.log(`${books.length} books to try${limit ? ` (limited to ${limit})` : ''}.\n`);

  let stored = 0;
  let notFound = 0;
  let failed = 0;

  for (const [index, book] of books.entries()) {
    const progress = `[${index + 1}/${books.length}]`;

    try {
      const bytes = await fetchCover(book.isbn);

      if (!bytes) {
        notFound++;
        console.log(`${progress} - ${book.title}: no cover at Open Library`);
      } else if (dryRun) {
        stored++;
        console.log(`${progress} ✓ ${book.title}: would store ${(bytes.length / 1024).toFixed(0)}KB`);
      } else {
        const url = await uploadCover(book.isbn, bytes);
        await setCoverUrl(book.id, url);
        stored++;
        console.log(`${progress} ✓ ${book.title}: stored ${(bytes.length / 1024).toFixed(0)}KB`);
      }
    } catch (error) {
      failed++;
      console.error(`${progress} ✗ ${book.title}: ${error.message}`);
    }

    // Be a good guest: Open Library is free and donation funded.
    await sleep(delayMs);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Tried:     ${books.length}`);
  console.log(`Stored:    ${stored}`);
  console.log(`No cover:  ${notFound}`);
  console.log(`Failed:    ${failed}`);
  if (dryRun) console.log(`\n(Dry run - nothing was written)`);
  console.log('');
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
