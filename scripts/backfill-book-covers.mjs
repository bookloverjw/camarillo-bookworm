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
 * Writing to books and to storage both need the service-role key. Get it
 * from the Supabase dashboard (Settings > API) and pass it via env -
 * NEVER commit it:
 *
 * Usage:
 *   # See what would happen, touching nothing (do this first):
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-book-covers.mjs --dry-run
 *
 *   # Try a small batch for real:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-book-covers.mjs --limit=50
 *
 *   # The whole catalogue (expect a few hours at the default pacing):
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-book-covers.mjs
 *
 * Options:
 *   --dry-run        Report what would be fetched and stored; write nothing.
 *   --limit=N        Stop after N books (default: no limit).
 *   --delay=MS       Pause between books (default: 250ms).
 *   --overwrite      Re-fetch books that already have a cover_url.
 *
 * Safe to stop and re-run: without --overwrite it only looks at rows whose
 * cover_url is still null, so a second run picks up where the first left off.
 */

const SUPABASE_URL = 'https://lildbdxabljkoynvpflu.supabase.co';
const BUCKET = 'book-covers';

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
  console.error('Both the books update and the storage upload need it.');
  console.error('Supabase dashboard > Settings > API > service_role.');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const overwrite = args.includes('--overwrite');
const limit = Number(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || null;
const delayMs = Number(args.find(a => a.startsWith('--delay='))?.split('=')[1]) || 250;

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
        `&order=id.asc&offset=${offset}&limit=${pageSize}`,
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

/** Pull one cover. Returns bytes, or null when there isn't a usable one. */
async function fetchCover(isbn) {
  const res = await fetch(coverUrlFor(isbn), { redirect: 'follow' });
  if (!res.ok) return null;

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
  console.log(dryRun ? 'Dry run - nothing will be written.\n' : 'Backfilling covers.\n');

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
