/**
 * Book pages with their own <head> - Vercel Serverless Function
 *
 * /book/:id is rewritten here (see vercel.json). Serves the app's index.html
 * with the book's title, description, cover and canonical URL filled in, so
 * link previews and crawlers that don't run JavaScript see the book rather
 * than the generic homepage tags. The React app then boots as usual.
 *
 * Never a dead end: if the book lookup fails, the plain index.html is served
 * and the page works exactly as it would without this function.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { titleCase } from './_lib/homepageBooks.js';

const SUPABASE_URL = 'https://lildbdxabljkoynvpflu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_h_B4nBpI9hTOycnv4Fj6Tw_epMD62aO';
const SITE_URL = 'https://www.camarillobookworm.com';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const stripTags = (html: string) =>
  html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function snippet(text: string, max = 160) {
  if (text.length <= max) return text;
  return text.slice(0, text.lastIndexOf(' ', max - 1)).replace(/[,;:.\s]+$/, '') + '…';
}

/** Swap the content of a meta tag (or the title / canonical) in the shell. */
function setTag(html: string, pattern: RegExp, replacement: string) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? '');
  const origin = `https://${req.headers.host}`;

  const shellResponse = await fetch(`${origin}/index.html`);
  let html = await shellResponse.text();

  try {
    const lookup = await fetch(
      `${SUPABASE_URL}/rest/v1/books?id=eq.${encodeURIComponent(id)}&select=id,title,author,description,cover_url`,
      { headers: { apikey: SUPABASE_ANON_KEY } },
    );
    const [book] = (await lookup.json()) as Array<{
      id: string; title: string; author: string; description: string | null; cover_url: string | null;
    }>;

    if (book) {
      const name = book.title === book.title.toUpperCase() ? titleCase(book.title) : book.title;
      const title = escapeHtml(`${name} by ${book.author} | Camarillo Bookworm`);
      const description = escapeHtml(snippet(
        `${name} by ${book.author} at Camarillo Bookworm in Camarillo, CA. ${stripTags(book.description ?? '')}`.trim(),
      ));
      const url = `${SITE_URL}/book/${encodeURIComponent(book.id)}`;

      html = setTag(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`);
      html = setTag(html, /(<meta name="description" content=")[^"]*/, `$1${description}`);
      html = setTag(html, /(<meta property="og:title" content=")[^"]*/, `$1${title}`);
      html = setTag(html, /(<meta property="og:description" content=")[^"]*/, `$1${description}`);
      html = setTag(html, /(<meta property="og:url" content=")[^"]*/, `$1${url}`);
      html = setTag(html, /(<meta property="og:type" content=")[^"]*/, '$1book');
      html = setTag(html, /(<meta name="twitter:title" content=")[^"]*/, `$1${title}`);
      html = setTag(html, /(<meta name="twitter:description" content=")[^"]*/, `$1${description}`);
      html = setTag(html, /(<link rel="canonical" href=")[^"]*/, `$1${url}`);
      if (book.cover_url) {
        const cover = escapeHtml(book.cover_url);
        html = setTag(html, /(<meta property="og:image" content=")[^"]*/, `$1${cover}`);
        html = setTag(html, /(<meta name="twitter:image" content=")[^"]*/, `$1${cover}`);
      }
    }
  } catch (error) {
    console.error('book-page lookup failed:', error);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Book details change rarely. Vercel's edge cache is per-deployment, so a
  // cached page never outlives the bundle hashes its shell points at.
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
  return res.status(200).send(html);
}
