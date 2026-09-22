#!/usr/bin/env node
/**
 * Save Coming Soon as public/coming-soon.json during the build, so the page
 * has the full list the moment it loads - even right after a deploy, when
 * /api/coming-soon's cache is empty and rebuilding it takes most of a minute.
 *
 * Never fails the build: if the lookups go wrong, the committed snapshot is
 * kept as it is (the page drops anything already released).
 */
import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const OUT = new URL('../public/coming-soon.json', import.meta.url);
const BUNDLE = new URL('../node_modules/.cache/coming-soon-snapshot.mjs', import.meta.url);

try {
  await build({
    entryPoints: [new URL('../api/coming-soon.ts', import.meta.url).pathname],
    bundle: true, platform: 'node', format: 'esm', outfile: BUNDLE.pathname, logLevel: 'error',
  });
  const { buildComingSoon } = await import(pathToFileURL(BUNDLE.pathname).href);
  // No time limit at build time, so every author gets checked, at a pace
  // Google Books' per-minute quota accepts (~90 a minute).
  const books = await Promise.race([
    buildComingSoon('https://www.camarillobookworm.com', new Date(), { concurrency: 1, delayMs: 650, budgetMs: 150_000 }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), 200_000)),
  ]);
  if (books.length >= 3) {
    await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), books }));
    console.log(`coming-soon snapshot: ${books.length} books`);
  } else {
    console.warn(`coming-soon snapshot: only ${books.length} books found; keeping the previous snapshot`);
  }
} catch (err) {
  console.warn(`coming-soon snapshot skipped (${err.message}); keeping the previous snapshot`);
}
process.exit(0);
