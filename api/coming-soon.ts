/**
 * Coming Soon - forthcoming books by authors readers already want.
 *
 *   GET /api/coming-soon -> { books: UpcomingBook[] }
 *
 * The authors are this week's NYT best sellers, the last two years' prize
 * winners, and a standing list of perennial bestsellers. Their future
 * editions come from Open Library, which carries publishers' preorder
 * records. That data is noisy (translations, year-only placeholders, box
 * sets), so a book only counts if it has an exact future release date, an
 * English edition with a US/UK ISBN, and was never published before.
 *
 * With GOOGLE_BOOKS_API_KEY set, Google Books is searched first - it has
 * far more preorder records - and Open Library fills in with whatever time
 * is left. Without a key it's Open Library alone. Once the ISBNdb weekly job
 * fills the upcoming_books table, the site prefers that.
 */

import { firstPublishedYears } from './_lib/firstPublished.js';

import { PERENNIAL } from './_lib/prominentAuthors.js';

export interface UpcomingBook {
  isbn: string;
  title: string;
  author: string;
  publication_date: string;
  cover_url: string | null;
  msrp: number | null;
  reason: string | null;
  catalog_id: string | null;
}

const MONTHS = 'january february march april may june july august september october november december'.split(' ');

/** An exact day from Open Library's free-text dates, or null ("2026", "cop. 2026", "janeiro de 2026"). */
export function exactDate(s: string): string | null {
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^([A-Za-z]+)\.? (\d{1,2}),? (\d{4})$/);            // October 20, 2026
  let month = m ? MONTHS.findIndex(x => x.startsWith(m![1].toLowerCase().slice(0, 3))) : -1;
  if (m && month >= 0) return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]+)\.?,? (\d{4})$/); // 16th June 2026
  month = m ? MONTHS.findIndex(x => x.startsWith(m![2].toLowerCase().slice(0, 3))) : -1;
  if (m && month >= 0) return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  // 12/31/2026 or 31/12/2026: only when the order is unambiguous.
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a > 12 && b <= 12) return `${m[3]}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    if (b > 12 && a <= 12) return `${m[3]}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
  }
  return null;
}

const fold = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const titleKey = (t: string) => fold(mainTitle(t).split(':')[0].replace(/\(.*$/, '')).replace(/^(the|a|an) /, '');

/** US/UK ISBN-13s: 978-0, 978-1, and the newer US 979-8 block. */
const isPrintIsbn = (i: string) => /^(97[89][01]|9798)\d{9}$/.test(i);

/** New editions of books already out, and publishers' placeholders - not new books. */
const EDITION = /tie-in|deluxe|anniversary|collector|special edition|\bedition\b|\billustrated\b|printed edges|sprayed edges|stenciled edges|\bsigned\b|\bPB\b|paperback|untitled|\(graphic novel\)|plush|silicone|short story|\s\d+$/i;

/** ISBNdb writes "Salt - A World History" and "Bride - Bride #1": the title is the part before " - ". */
const mainTitle = (t: string) => t.split(/\s+-\s+/)[0];

const SKIP = /box(ed)? set|collection|books? set|\bset\b|omnibus|coloring|calendar|journal|summary|study guide|\/|\bvol(ume)?\.? ?\d+ ?- ?\d+/i;

interface Doc {
  key: string; title: string; author_name?: string[]; publish_date?: string[];
  first_publish_year?: number; isbn?: string[]; cover_i?: number; language?: string[];
}

async function forAuthor(name: string, reason: string, today: string, horizon: string): Promise<UpcomingBook[]> {
  const q = new URLSearchParams({
    author: name, sort: 'new', limit: '12',
    fields: 'key,title,author_name,publish_date,first_publish_year,isbn,cover_i,language',
  });
  let r: Response | null = null;
  // Open Library throttles bursts with 429s; back off and try again.
  for (let attempt = 0; attempt < 3; attempt++) {
    r = await fetch(`https://openlibrary.org/search.json?${q}`, {
      headers: { 'User-Agent': 'CamarilloBookworm/1.0 (www.camarillobookworm.com)' },
      signal: AbortSignal.timeout(10000),
    });
    if (r.status !== 429 && r.status < 500) break;
    await new Promise(done => setTimeout(done, 1500 * (attempt + 1)));
  }
  if (!r?.ok) throw new Error(`Open Library ${r?.status}`);
  const { docs = [] } = (await r.json()) as { docs?: Doc[] };
  const out: UpcomingBook[] = [];
  const thisYear = Number(today.slice(0, 4));
  for (const d of docs) {
    if (SKIP.test(d.title) || EDITION.test(d.title)) continue;
    if ((d.first_publish_year ?? 0) < thisYear) continue;
    if (d.language && !d.language.includes('eng')) continue;
    // This author has to be the book's main author: listed first, not a
    // co-contributor such as the writer of an introduction.
    if (fold(d.author_name?.[0] ?? '') !== fold(name)) continue;
    const dates = (d.publish_date ?? []).map(exactDate).filter((x): x is string => !!x);
    // Already out in some edition, or no exact release date: not "coming soon".
    if (!dates.length || dates.some(x => x <= today)) continue;
    const date = dates.sort()[0];
    if (date > horizon) continue;
    const isbn = (d.isbn ?? []).find(isPrintIsbn);
    if (!isbn) continue;
    out.push({
      isbn, title: d.title, author: name, publication_date: date,
      cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
      msrp: null, reason, catalog_id: null,
    });
  }
  return out;
}

interface Volume {
  volumeInfo: {
    title: string; subtitle?: string; authors?: string[]; publishedDate?: string; language?: string;
    industryIdentifiers?: { type: string; identifier: string }[]; imageLinks?: { thumbnail?: string };
  };
}

async function googleForAuthor(key: string, name: string, reason: string, today: string, horizon: string): Promise<UpcomingBook[]> {
  const q = new URLSearchParams({
    q: `inauthor:"${name}"`, orderBy: 'newest', maxResults: '20', printType: 'books', langRestrict: 'en', key,
  });
  let r: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      r = await fetch(`https://www.googleapis.com/books/v1/volumes?${q}`, {
        // The key is restricted to our website; server-side calls carry no referer unless we send it.
        headers: { Referer: 'https://www.camarillobookworm.com/' },
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      if (attempt === 2) throw err; // a slow moment; try again
      continue;
    }
    if (r.status !== 429) break;
    await new Promise(done => setTimeout(done, 2000 * (attempt + 1))); // per-minute quota
  }
  if (!r) throw new Error('Google Books: no response');
  if (!r.ok) {
    const detail = await r.json().then(b => b?.error?.message as string | undefined).catch(() => undefined);
    throw new Error(`Google Books ${r.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`);
  }
  const { items = [] } = (await r.json()) as { items?: Volume[] };
  const out: UpcomingBook[] = [];
  for (const { volumeInfo: v } of items) {
    const date = v.publishedDate ?? '';
    // An exact day, still ahead, within the horizon.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= today || date > horizon) continue;
    if (v.language && v.language !== 'en') continue;
    if (SKIP.test(v.title) || EDITION.test(v.title) || fold(v.authors?.[0] ?? '') !== fold(name)) continue;
    const isbn = (v.industryIdentifiers ?? []).map(x => x.identifier).find(isPrintIsbn);
    if (!isbn) continue;
    const thumb = v.imageLinks?.thumbnail?.replace(/^http:/, 'https:').replace(/&edge=curl/, '');
    out.push({ isbn, title: v.title, author: name, publication_date: date, cover_url: thumb ?? null, msrp: null, reason, catalog_id: null });
  }
  return out;
}

/**
 * What the weekly ISBNdb job found (scripts/isbndb/refresh-coming-soon.mjs),
 * put through the same filters as the other sources: ISBNdb lists boxed
 * sets, collector's editions and even figurines alongside new books.
 */
async function isbndbUpcoming(today: string, horizon: string): Promise<{ books: UpcomingBook[]; error: string | null }> {
  const q = new URLSearchParams({
    select: 'isbn,title,author,publication_date,cover_url,msrp,reason,catalog_id',
    publication_date: `gt.${today}`, order: 'publication_date.asc', limit: '200',
  });
  let error: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/upcoming_books?${q}`, {
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error(`upcoming_books ${r.status}`);
      const rows = (await r.json()) as UpcomingBook[];
      const books = rows.filter(b => b.publication_date <= horizon && isPrintIsbn(b.isbn) && !SKIP.test(b.title) && !EDITION.test(b.title)
        && !/figurine|poster|boxed|box set|\d-book|collection/i.test(b.title));
      return { books, error: null };
    } catch (err) {
      error = (err as Error).message;
    }
  }
  return { books: [], error };
}

// Public by design: the same values the browser uses (src/lib/supabase.ts).
const SUPABASE_URL = 'https://lildbdxabljkoynvpflu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_h_B4nBpI9hTOycnv4Fj6Tw_epMD62aO';

/** Run fn over items, a few at a time, to stay polite to Open Library. */
async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>, budgetMs = 40000): Promise<R[]> {
  const out: R[] = [];
  const deadline = Date.now() + budgetMs;
  let i = 0;
  let failures = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    // Stop starting new lookups once the budget is spent, well inside maxDuration.
    while (i < items.length && Date.now() < deadline) {
      const item = items[i++];
      try { out.push(await fn(item)); } catch (err) {
        // One slow author shouldn't sink the list.
        failures++;
        if (failures <= 3) console.warn('coming-soon lookup failed:', (err as Error).message);
      }
    }
  }));
  if (failures || i < items.length) console.warn(`coming-soon: ${failures} failed, ${items.length - i} skipped for time`);
  return out;
}

/** Where the last build's books came from, for diagnosing a thin list. */
let lastSources: Record<string, unknown> = {};
export const comingSoonSources = () => lastSources;

/**
 * Google Books allows about 100 lookups a minute, and there are ~150 authors.
 * The live function has under a minute, so it checks the first ones (the
 * perennial bestsellers come first); the build-time snapshot, with time to
 * spare, checks them all at a pace Google accepts.
 */
export interface Pace { concurrency: number; delayMs: number; budgetMs: number }
const LIVE_PACE: Pace = { concurrency: 2, delayMs: 600, budgetMs: 25000 };

export async function buildComingSoon(origin: string, now = new Date(), pace: Pace = LIVE_PACE): Promise<UpcomingBook[]> {
  const today = now.toISOString().slice(0, 10);
  const h = new Date(now); h.setUTCMonth(h.getUTCMonth() + 8);
  const horizon = h.toISOString().slice(0, 10);

  const authors = new Map<string, string>();
  const add = (name: string | undefined, reason: string) => {
    const clean = (name || '').split(/,| and | with /i)[0].replace(/\s+/g, ' ').trim();
    if (clean.length > 3 && !authors.has(clean)) authors.set(clean, reason);
  };

  for (const a of PERENNIAL) add(a, 'From a bestselling author');
  // Read what the ISBNdb job found now, alongside everything else, rather
  // than at the end when the function is short on time.
  const isbndbRead = isbndbUpcoming(today, horizon);
  const [lists, awards] = await Promise.all([
    fetch(`${origin}/api/homepage-books`, { signal: AbortSignal.timeout(10000) }).then(r => (r.ok ? r.json() : null)).catch(() => null),
    fetch(`${origin}/collections/awards.json`, { signal: AbortSignal.timeout(10000) }).then(r => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  for (const shelf of Object.values<any[]>(lists?.bestsellers ?? {})) {
    for (const b of shelf) add(b.author, "From an author on this week's NYT best seller list");
  }
  if (awards) {
    const name = new Map<string, string>(awards.awards.map((a: any) => [a.id, a.name]));
    const latest = Math.max(...awards.results.map((r: any) => r.year));
    for (const r of awards.results) {
      if (r.result === 'winner' && r.year >= latest - 1) add(r.book.author.replace(/\s*\(illustrator\)/, ''), `From a ${name.get(r.award)} winner`);
    }
  }

  const queue = [...authors].slice(0, 150);
  const started = Date.now();
  const googleKey = process.env.GOOGLE_BOOKS_API_KEY;
  // Google first when there's a key: it's fast and far more complete.
  let googleError: string | null = null;
  const fromGoogle = googleKey
    ? (await pool(queue, pace.concurrency, async ([n, why]) => {
        await new Promise(done => setTimeout(done, pace.delayMs));
        return googleForAuthor(googleKey, n, why, today, horizon).catch(err => {
          googleError ??= (err as Error).message;
          throw err;
        });
      }, pace.budgetMs)).flat()
    : [];
  const fromOpenLibrary = (await pool(queue, 8, ([n, why]) => forAuthor(n, why, today, horizon),
    Math.max(5000, pace.budgetMs + 13000 - (Date.now() - started)))).flat();
  // A paperback, tie-in or reissue of an older book isn't coming soon: drop
  // anything Open Library says was first in print before this year.
  const { books: fromIsbndb, error: isbndbError } = await isbndbRead;
  const candidates = [...fromIsbndb, ...fromGoogle, ...fromOpenLibrary];
  const firstYears = await firstPublishedYears(candidates.map(b => ({ ...b, title: mainTitle(b.title) })), 8000)
    .catch(() => new Map<string, number>());
  const thisYear = Number(today.slice(0, 4));
  const found = candidates.filter(b => (firstYears.get(b.isbn) ?? thisYear) >= thisYear);
  lastSources = { googleKey: !!googleKey, google: fromGoogle.length, googleError, openLibrary: fromOpenLibrary.length,
    isbndb: fromIsbndb.length, isbndbError, reissuesDropped: candidates.length - found.length };
  const seen = new Set<string>();
  return found
    .sort((a, b) => a.publication_date.localeCompare(b.publication_date))
    .filter(b => {
      const k = `${titleKey(b.title)}|${fold(b.author)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

export default async function handler(req: any, res: any) {
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  const origin = host && !/localhost|127\.0\.0\.1/.test(host) ? `https://${host}` : 'https://www.camarillobookworm.com';
  try {
    const books = await buildComingSoon(origin);
    // Release dates move slowly; refresh daily, serve stale for a week.
    res.setHeader('Cache-Control', books.length
      ? 'public, s-maxage=86400, stale-while-revalidate=604800'
      : 'public, s-maxage=600');
    return res.status(200).json({ books, sources: lastSources });
  } catch (err) {
    console.error('coming-soon failed', err);
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(502).json({ error: 'Could not build Coming Soon' });
  }
}

export const config = { maxDuration: 60 };
