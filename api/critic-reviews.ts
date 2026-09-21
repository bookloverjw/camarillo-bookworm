/**
 * Does Book Marks have critic reviews for this ISBN? - Vercel Serverless Function
 *
 * GET /api/critic-reviews?isbn=9780385550369
 *   -> { hasReviews: true, verdict: "Rave", count: 27 }
 *
 * The site embeds Book Marks' own review widget (src/app/components/
 * BookmarksReviews.tsx), but for a book Book Marks hasn't covered - most of
 * them - that widget renders an empty box. This checks first, so pages and
 * quick views can leave the section out instead.
 *
 * It returns only whether reviews exist and their headline verdict and count;
 * the reviews themselves are the critics' work and are shown only through
 * Book Marks' widget, as they intend.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Looking through other editions takes a few round trips; each is capped
// below so a slow upstream can't run the function into the platform limit.
export const config = { maxDuration: 45 };

const VERDICTS = ['Rave', 'Positive', 'Mixed', 'Pan'];

/**
 * Editions Open Library files as separate works, so the automatic lookup
 * below can't connect them to the edition Book Marks reviewed. Add a pair
 * here when a book that was plainly reviewed comes up empty.
 */
const REVIEWED_EDITION: Record<string, string> = {
  // The Odyssey, trans. Emily Wilson: our Norton paperback -> 2017 hardcover.
  '9780393356250': '9780393089059',
};
const UA = { 'User-Agent': 'CamarilloBookworm/1.0 (+https://www.camarillobookworm.com)' };

/** fetch with a deadline: Open Library in particular can hang for a long time. */
const get = (url: string, ms: number) => fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });

/** Book Marks' verdict and review count for exactly this ISBN, or null. */
async function reviewsFor(isbn: string): Promise<{ verdict: string | null; count: number } | null> {
  const page = await get(`https://lithub.com/book-widget/${isbn}/0/0/?ver=1.5.1`, 6000);
  if (!page.ok) throw new Error(`Book Marks ${page.status}`);
  const text = (await page.text())
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  // The widget leads with e.g. "What The Reviewers Say Rave Based on 27 reviews".
  const match = text.match(/What The Reviewers Say\s+(\w+)\s+Based on\s+(\d+)\s+reviews?/i);
  if (!match) return null;
  return { verdict: VERDICTS.find(v => v.toLowerCase() === match[1].toLowerCase()) ?? null, count: Number(match[2]) };
}

/**
 * Other editions of the same book, likeliest to be reviewed first. Book Marks
 * files reviews under the first edition - usually the US hardcover - so a
 * paperback, which is most of what we stock, finds nothing on its own ISBN:
 * Project Hail Mary's paperback has no reviews there, its hardcover has 18.
 * Open Library groups editions into a "work" and records each one's format
 * and date, so: English-language (978-0/978-1) hardcovers, earliest first,
 * then any other English-language edition.
 */
async function otherEditions(isbn: string): Promise<string[]> {
  const edition = await get(`https://openlibrary.org/isbn/${isbn}.json`, 15000);
  if (!edition.ok) return [];
  const work = (await edition.json())?.works?.[0]?.key;
  if (!work) return [];
  const res = await get(`https://openlibrary.org${work}/editions.json?limit=50`, 15000);
  if (!res.ok) return [];
  const english = (i: string) => /^97[89][01]/.test(i);
  const year = (d?: string) => Number((d || '').match(/\d{4}/)?.[0] ?? 9999);
  const editions = ((await res.json())?.entries ?? []).flatMap((e: any) =>
    (e.isbn_13 ?? []).filter(english).map((i: string) => ({
      isbn: i, hard: /hard/i.test(e.physical_format || ''), year: year(e.publish_date),
    })),
  );
  editions.sort((a: any, b: any) => Number(b.hard) - Number(a.hard) || a.year - b.year);
  return [...new Set<string>(editions.map((e: any) => e.isbn))].filter(i => i !== isbn);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isbn = String(req.query.isbn || '').replace(/[^0-9Xx]/g, '');
  if (!/^(\d{9}[\dXx]|\d{13})$/.test(isbn)) {
    return res.status(400).json({ error: 'Pass a 10- or 13-digit isbn' });
  }

  try {
    // Start the slow other-editions search straight away, but answer as soon
    // as this ISBN turns out to have reviews of its own - most reviewed books.
    // null when the search itself failed (Open Library is often slow from
    // here), as opposed to [] for a book that simply has no other editions.
    const alternatesSearch = otherEditions(isbn).catch(() => null);
    let found = await reviewsFor(isbn).catch(() => null);
    let reviewedIsbn = isbn;
    let searchFailed = false;

    // A pair we already know about needs no search at all.
    const known = REVIEWED_EDITION[isbn];
    if (!found && known) {
      const hit = await reviewsFor(known).catch(() => null);
      if (hit) {
        found = hit;
        reviewedIsbn = known;
      }
    }

    if (!found) {
      const alternates = await alternatesSearch;
      searchFailed = alternates === null;
      const candidates = [...new Set([...(known ? [known] : []), ...(alternates ?? [])])].slice(0, 4);
      const results = await Promise.all(candidates.map(i => reviewsFor(i).catch(() => null)));
      const hit = results.findIndex(Boolean);
      if (hit >= 0) {
        found = results[hit];
        reviewedIsbn = candidates[hit];
      }
    }

    // Reviews change slowly: cache a day, serve a week-old copy while
    // refreshing. But a "no" we couldn't finish checking - the edition search
    // timed out - is only a guess, so it gets another try within the hour
    // instead of standing for a day.
    res.setHeader(
      'Cache-Control',
      !found && searchFailed
        ? 'public, s-maxage=600, stale-while-revalidate=3000'
        : 'public, s-maxage=86400, stale-while-revalidate=604800',
    );
    // isbn is the edition Book Marks reviewed, which is what its widget needs.
    return res.status(200).json(found ? { hasReviews: true, isbn: reviewedIsbn, ...found } : { hasReviews: false });
  } catch (error) {
    console.error('critic-reviews failed:', error);
    // Try again in an hour rather than on every visitor's page load.
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(502).json({ hasReviews: false });
  }
}
