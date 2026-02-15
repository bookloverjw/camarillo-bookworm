#!/usr/bin/env node
/**
 * Enrich Kids books with topic tags from ISBNdb or Google Books API.
 *
 * The tags column (TEXT[] on the books table) powers the "Shop by Topic"
 * tiles on the Kids department page. This script fetches subject/category
 * data for each Kids book and maps it to topic keywords.
 *
 * Usage:
 *   # Using ISBNdb (recommended, $14.95/mo, richer subject data):
 *   ISBNDB_API_KEY=your_key node scripts/enrich-book-tags.mjs
 *
 *   # Using Google Books API (free, no key needed):
 *   node scripts/enrich-book-tags.mjs --google-books
 *
 *   # Dry run (show what would change without updating):
 *   node scripts/enrich-book-tags.mjs --google-books --dry-run
 *
 *   # Process ALL categories, not just Kids:
 *   node scripts/enrich-book-tags.mjs --google-books --all-categories
 */

// --- Configuration ---
const SUPABASE_URL = 'https://lildbdxabljkoynvpflu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_h_B4nBpI9hTOycnv4Fj6Tw_epMD62aO';
const ISBNDB_API_KEY = process.env.ISBNDB_API_KEY;

const useGoogleBooks = process.argv.includes('--google-books');
const dryRun = process.argv.includes('--dry-run');
const allCategories = process.argv.includes('--all-categories');

// --- Topic matchers ---
// Each entry maps ISBNdb/Google Books subject strings to our topic keywords.
// These keywords match the KIDS_TOPICS in Shop.tsx.
const TOPIC_MATCHERS = [
  {
    keywords: ['dinosaur', 'prehistoric'],
    match: /dinosaur|prehistoric|dino|t[\s-]?rex|tyrannosaurus|jurassic|fossil|paleontolog/i,
  },
  {
    keywords: ['dragon'],
    match: /\bdragon\b/i,
  },
  {
    keywords: ['car', 'truck', 'vehicle', 'train'],
    match: /\bcar\b|truck|vehicle|automobile|train|bus\b|tractor|transportation/i,
  },
  {
    keywords: ['animal', 'pet', 'farm', 'zoo'],
    match: /animal|pet\b|dog\b|cat\b|puppy|kitten|farm|zoo|bunny|rabbit|horse|pony|bear\b|elephant|monkey/i,
  },
  {
    keywords: ['space', 'rocket', 'astronaut', 'planet'],
    match: /\bspace\b|rocket|astronaut|planet|moon\b|stars?\b|galaxy|solar system|cosmos|astronomy/i,
  },
  {
    keywords: ['fairy', 'magic', 'magical', 'wizard', 'witch'],
    match: /fairy|faerie|magic|wizard|witch|enchant|spell|sorcerer|supernatural|mythical/i,
  },
  {
    keywords: ['princess', 'prince', 'queen', 'king', 'castle', 'royal'],
    match: /princess|prince|queen|king|castle|royal|kingdom|crown|knight/i,
  },
  {
    keywords: ['pirate', 'adventure', 'treasure', 'quest'],
    match: /pirate|treasure|adventure|explorer|quest|voyage|expedition/i,
  },
  {
    keywords: ['ocean', 'sea', 'fish', 'whale', 'shark', 'mermaid', 'dolphin'],
    match: /ocean|sea\b|fish|whale|shark|mermaid|dolphin|marine|underwater|aquatic/i,
  },
  {
    keywords: ['superhero', 'hero'],
    match: /superhero|super[\s-]?hero|superpower|super[\s-]?power|comic.*hero/i,
  },
  {
    keywords: ['bug', 'insect', 'butterfly', 'nature', 'garden'],
    match: /\bbug\b|insect|butterfly|bee\b|nature|garden|flower|caterpillar|ladybug|spider/i,
  },
  {
    keywords: ['sport', 'soccer', 'baseball', 'basketball', 'football'],
    match: /sport|soccer|baseball|basketball|football|tennis|swimming|hockey|athletic/i,
  },
  {
    keywords: ['art', 'draw', 'paint', 'craft', 'creative', 'music'],
    match: /\bart\b|draw|paint|color|colour|craft|creative|music|dance|sing/i,
  },
];

// --- Helpers ---

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mapSubjectsToTags(subjects) {
  const tags = new Set();
  const subjectStr = subjects.join(' ');

  for (const topic of TOPIC_MATCHERS) {
    if (topic.match.test(subjectStr)) {
      for (const kw of topic.keywords) {
        tags.add(kw);
      }
    }
  }

  return [...tags];
}

// --- API fetchers ---

async function fetchIsbndbSubjects(isbn) {
  try {
    const res = await fetch(`https://api2.isbndb.com/book/${isbn}`, {
      headers: { Authorization: ISBNDB_API_KEY },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.book?.subjects || [];
  } catch {
    return [];
  }
}

async function fetchGoogleBooksSubjects(isbn) {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&fields=items(volumeInfo/categories,volumeInfo/description)`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const volume = data.items?.[0]?.volumeInfo;
    // Google Books returns categories and also a description we can mine
    const cats = volume?.categories || [];
    // Also include description keywords if available
    if (volume?.description) {
      cats.push(volume.description);
    }
    return cats;
  } catch {
    return [];
  }
}

// --- Supabase helpers ---

async function fetchBooks() {
  const categoryFilter = allCategories ? '' : '&category=eq.Kids';
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/books?select=id,isbn,title,tags${categoryFilter}&order=title`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  if (!res.ok) {
    console.error('Failed to fetch books:', res.status, await res.text());
    process.exit(1);
  }
  return res.json();
}

async function updateBookTags(id, tags) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/books?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ tags }),
  });
  return res.ok;
}

// --- Main ---

async function main() {
  if (!useGoogleBooks && !ISBNDB_API_KEY) {
    console.error(
      'Error: Set ISBNDB_API_KEY environment variable, or use --google-books flag.\n\n' +
        'Examples:\n' +
        '  ISBNDB_API_KEY=your_key node scripts/enrich-book-tags.mjs\n' +
        '  node scripts/enrich-book-tags.mjs --google-books\n'
    );
    process.exit(1);
  }

  const apiName = useGoogleBooks ? 'Google Books' : 'ISBNdb';
  const rateLimit = useGoogleBooks ? 200 : 1100; // ms between requests

  console.log(`\n📚 Book Tags Enrichment Script`);
  console.log(`   API: ${apiName}`);
  console.log(`   Scope: ${allCategories ? 'All categories' : 'Kids only'}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  const books = await fetchBooks();
  console.log(`Found ${books.length} books to process.\n`);

  let enriched = 0;
  let skipped = 0;
  let noMatch = 0;

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    const progress = `[${i + 1}/${books.length}]`;

    if (!book.isbn) {
      console.log(`${progress} SKIP ${book.title} (no ISBN)`);
      skipped++;
      continue;
    }

    const subjects = useGoogleBooks
      ? await fetchGoogleBooksSubjects(book.isbn)
      : await fetchIsbndbSubjects(book.isbn);

    const newTags = mapSubjectsToTags(subjects);

    if (newTags.length > 0) {
      // Merge with existing tags (deduplicate)
      const existingTags = book.tags || [];
      const mergedTags = [...new Set([...existingTags, ...newTags])];

      if (!dryRun) {
        const ok = await updateBookTags(book.id, mergedTags);
        if (!ok) {
          console.log(`${progress} ERROR updating ${book.title}`);
          continue;
        }
      }

      enriched++;
      console.log(`${progress} ✓ ${book.title}: ${mergedTags.join(', ')}`);
    } else {
      noMatch++;
      const subjectPreview = subjects.slice(0, 2).join('; ').substring(0, 80);
      console.log(
        `${progress} - ${book.title}: no topics matched${subjectPreview ? ` (subjects: ${subjectPreview}...)` : ''}`
      );
    }

    // Respect rate limits
    await sleep(rateLimit);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total:    ${books.length}`);
  console.log(`Enriched: ${enriched}`);
  console.log(`No match: ${noMatch}`);
  console.log(`Skipped:  ${skipped} (no ISBN)`);
  if (dryRun) console.log(`\n(Dry run — no changes were saved)`);
  console.log('');
}

main().catch(console.error);
