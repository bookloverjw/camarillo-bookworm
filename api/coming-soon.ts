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
 * This needs no API key. Once the ISBNdb weekly job fills the upcoming_books
 * table, the site prefers that and this is only the fallback.
 */

const PERENNIAL = [
  'Louise Penny', 'Stephen King', 'Brandon Sanderson', 'Emily Henry', 'Kristin Hannah', 'Freida McFadden',
  'Rebecca Yarros', 'Sarah J. Maas', 'Colleen Hoover', 'Michael Connelly', 'John Grisham', 'Jodi Picoult',
  'Liane Moriarty', 'Richard Osman', 'Taylor Jenkins Reid', 'Sally Rooney', 'Barbara Kingsolver',
  'Louise Erdrich', 'Ann Patchett', 'Rick Riordan', 'Dav Pilkey', 'Jeff Kinney', 'Andy Weir',
  'Martha Wells', 'Adrian Tchaikovsky', 'Matt Dinniman', 'Erik Larson', 'David Grann', 'Kate Quinn',
  'Fredrik Backman', 'Lucy Foley', 'Ruth Ware', 'Harlan Coben', 'Lee Child', 'David Baldacci',
  'Abby Jimenez', 'Ali Hazelwood', 'Mick Herron', 'Tana French', 'R. F. Kuang', 'Holly Jackson',
  'Jennifer Lynn Barnes', 'Suzanne Collins', 'Percival Everett', 'Kazuo Ishiguro', 'Kiley Reid',
];

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

const titleKey = (t: string) => fold(t.split(':')[0].replace(/\(.*$/, '')).replace(/^(the|a|an) /, '');

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
    if (SKIP.test(d.title)) continue;
    if ((d.first_publish_year ?? 0) < thisYear) continue;
    if (d.language && !d.language.includes('eng')) continue;
    // The author has to be this author, not a namesake or a study-guide writer.
    if (!(d.author_name ?? []).some(a => fold(a) === fold(name))) continue;
    const dates = (d.publish_date ?? []).map(exactDate).filter((x): x is string => !!x);
    // Already out in some edition, or no exact release date: not "coming soon".
    if (!dates.length || dates.some(x => x <= today)) continue;
    const date = dates.sort()[0];
    if (date > horizon) continue;
    const isbn = (d.isbn ?? []).find(i => /^97[89][01]\d{9}$/.test(i));
    if (!isbn) continue;
    out.push({
      isbn, title: d.title, author: name, publication_date: date,
      cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
      msrp: null, reason, catalog_id: null,
    });
  }
  return out;
}

/** Run fn over items, a few at a time, to stay polite to Open Library. */
async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  let failures = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) {
      const item = items[i++];
      try { out.push(await fn(item)); } catch (err) {
        // One slow author shouldn't sink the list.
        failures++;
        if (failures <= 3) console.warn('coming-soon lookup failed:', (err as Error).message);
      }
    }
  }));
  if (failures) console.warn(`coming-soon: ${failures} of ${items.length} lookups failed`);
  return out;
}

export async function buildComingSoon(origin: string, now = new Date()): Promise<UpcomingBook[]> {
  const today = now.toISOString().slice(0, 10);
  const h = new Date(now); h.setUTCMonth(h.getUTCMonth() + 8);
  const horizon = h.toISOString().slice(0, 10);

  const authors = new Map<string, string>();
  const add = (name: string | undefined, reason: string) => {
    const clean = (name || '').split(/,| and | with /i)[0].replace(/\s+/g, ' ').trim();
    if (clean.length > 3 && !authors.has(clean)) authors.set(clean, reason);
  };

  for (const a of PERENNIAL) add(a, 'From a bestselling author');
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

  const found = (await pool([...authors].slice(0, 150), 8, ([n, why]) => forAuthor(n, why, today, horizon))).flat();
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
    return res.status(200).json({ books });
  } catch (err) {
    console.error('coming-soon failed', err);
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(502).json({ error: 'Could not build Coming Soon' });
  }
}

export const config = { maxDuration: 60 };
