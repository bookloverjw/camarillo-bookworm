#!/usr/bin/env node
/**
 * After `vite build`: give each public page its own HTML file with its own
 * <head>, and write the sitemap.
 *
 * The site is a single-page app, so every URL would otherwise serve the same
 * index.html with the homepage's title and description. Google runs the
 * JavaScript and sees the real ones, but link previews (Facebook, iMessage,
 * Slack) and simpler crawlers do not. For each static route this writes
 * dist/<route>/index.html - the same app shell, with that page's title,
 * description, canonical URL and Open Graph tags already in place.
 *
 * Book pages (/book/:id) get the same treatment at request time from
 * api/book-page.ts - there are far too many to write out here.
 *
 * Never fails the build: the sitemap's book list is skipped if the catalogue
 * can't be read.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';

const SITE_URL = 'https://www.camarillobookworm.com';
const STORE_NAME = 'Camarillo Bookworm';
const SUPABASE_URL = 'https://lildbdxabljkoynvpflu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_h_B4nBpI9hTOycnv4Fj6Tw_epMD62aO';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function snippet(text, max = 160) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, clean.lastIndexOf(' ', max - 1)).replace(/[,;:.\s]+$/, '') + '…';
}

// --- Collect the pages -------------------------------------------------------

/** path -> { title, description, changefreq, priority } */
const pages = new Map();

const routeMeta = JSON.parse(await readFile(new URL('src/lib/routeMeta.json', root), 'utf8'));
const FREQUENCY = { '/': ['weekly', 1.0], '/shop': ['daily', 0.9], '/events': ['daily', 0.9], '/staff-picks': ['weekly', 0.8] };
for (const [path, meta] of Object.entries(routeMeta)) {
  const [changefreq, priority] = FREQUENCY[path] ?? ['monthly', 0.6];
  pages.set(path, { ...meta, changefreq, priority });
}

const collectionsDir = new URL('public/collections/', root);
for (const file of await readdir(collectionsDir)) {
  if (!file.endsWith('.json')) continue;
  const data = JSON.parse(await readFile(new URL(file, collectionsDir), 'utf8'));
  if (file === 'awards.json') {
    for (const award of data.awards) {
      pages.set(`/collections/awards/${award.id}`, {
        title: `${award.name}: ${award.category}`,
        description: snippet(`${award.name} for ${award.category}: every year's winners and finalists, at ${STORE_NAME} in Camarillo, CA.`),
        changefreq: 'monthly',
        priority: 0.5,
      });
    }
  } else if (data.slug) {
    pages.set(`/collections/${data.slug}`, {
      title: data.title,
      description: snippet(data.description || data.tagline || data.title),
      changefreq: 'monthly',
      priority: 0.6,
    });
  }
}

// --- One HTML file per page --------------------------------------------------

const shell = await readFile(new URL('index.html', dist), 'utf8');

for (const [path, page] of pages) {
  if (path === '/') continue; // index.html already carries the homepage's tags
  const title = escapeHtml(`${page.title} | ${STORE_NAME}`);
  const description = escapeHtml(page.description);
  const url = `${SITE_URL}${path}`;

  const html = shell
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${description}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${title}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${description}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${title}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${description}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`);

  const dir = new URL(`.${path}/`, dist);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL('index.html', dir), html);
}
console.log(`prerender-head: ${pages.size - 1} pages`);

// --- Sitemap -----------------------------------------------------------------

const urls = [...pages].map(([path, page]) =>
  `  <url><loc>${SITE_URL}${path}</loc><changefreq>${page.changefreq}</changefreq><priority>${page.priority.toFixed(1)}</priority></url>`);

try {
  let bookCount = 0;
  for (let from = 0; ; from += 1000) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/books?select=id,updated_at&order=id&offset=${from}&limit=1000`,
      { headers: { apikey: SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(20_000) },
    );
    if (!response.ok) throw new Error(`catalogue responded ${response.status}`);
    const books = await response.json();
    for (const book of books) {
      const lastmod = book.updated_at ? `<lastmod>${book.updated_at.slice(0, 10)}</lastmod>` : '';
      urls.push(`  <url><loc>${SITE_URL}/book/${encodeURIComponent(book.id)}</loc>${lastmod}<priority>0.4</priority></url>`);
    }
    bookCount += books.length;
    if (books.length < 1000) break;
  }
  console.log(`sitemap: ${bookCount} books`);
} catch (err) {
  console.warn(`sitemap: book pages left out (${err.message})`);
}

await writeFile(
  new URL('sitemap.xml', dist),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
);
console.log(`sitemap: ${urls.length} URLs`);
