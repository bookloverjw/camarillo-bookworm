#!/usr/bin/env node
/**
 * Save Coming Soon as public/coming-soon.json during the build, so the page
 * has the full list the moment it loads - even right after a deploy, when
 * /api/coming-soon's cache is empty and rebuilding it takes most of a minute.
 *
 * It copies the list the live site already built (usually straight from the
 * edge cache) rather than building one: builds happen many times a day, and
 * each full build costs ~150 Google Books lookups against a daily quota. A
 * shorter list never replaces a longer one, and a failure never fails the
 * build - the committed snapshot stays (the page drops anything released).
 */
import { readFile, writeFile } from 'node:fs/promises';

const OUT = new URL('../public/coming-soon.json', import.meta.url);
const LIVE = 'https://www.camarillobookworm.com/api/coming-soon';

const today = new Date().toISOString().slice(0, 10);
const upcoming = list => (list ?? []).filter(b => b.publication_date > today);

try {
  const previous = JSON.parse(await readFile(OUT, 'utf8').catch(() => '{}'));
  const response = await fetch(LIVE, { signal: AbortSignal.timeout(75_000) });
  if (!response.ok) throw new Error(`live list returned ${response.status}`);
  const live = await response.json();
  const books = upcoming(live.books);
  if (books.length >= Math.max(3, upcoming(previous.books).length)) {
    await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), sources: live.sources, books }));
    console.log(`coming-soon snapshot: ${books.length} books`, JSON.stringify(live.sources ?? {}));
  } else {
    console.warn(`coming-soon snapshot: live list has ${books.length} books, the saved one ${upcoming(previous.books).length}; keeping the saved one`);
  }
} catch (err) {
  console.warn(`coming-soon snapshot skipped (${err.message}); keeping the saved one`);
}
process.exit(0);
