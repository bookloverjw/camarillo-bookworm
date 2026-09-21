/**
 * Was this book really published recently, or is it an older book in a new
 * jacket? A title can be "new" to a best seller list - or carry a recent
 * publication date in our catalogue - because of a paperback release, a film
 * tie-in or a reissue (Kiki's Delivery Service charted in 2026; it is a 1985
 * book). Open Library groups editions into works and knows each work's first
 * year in print, which is what settles it.
 *
 * Open Library is thorough on older books and patchy on brand-new ones, which
 * suits this: a book it has never heard of is almost certainly new.
 *
 * Books are looked up a batch at a time - one search for fifteen titles takes
 * about as long as a search for one, and Open Library slows right down when
 * asked many things at once.
 */
const fold = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const titleKey = (t: string) => fold(t.split(':')[0].replace(/\(.*$/, '')).replace(/^(the|a|an) /, '');

/** "Dave Mustaine with Joe Layden" -> "mustaine": the first author's surname. */
const surname = (author: string) => fold(author.split(/,| and | with /i)[0]).split(' ').pop() ?? '';

/** Plain words only: quotes, colons and brackets all mean something to the search syntax. */
const phrase = (s: string) => s.replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();

const BATCH = 15;

export interface BookToCheck { isbn: string; title: string; author: string }

/**
 * The first year each work was in print, keyed by ISBN. Books Open Library
 * doesn't know are left out of the map; a failed batch is left out too.
 */
export async function firstPublishedYears(books: BookToCheck[], budgetMs = 8000): Promise<Map<string, number>> {
  const years = new Map<string, number>();
  const deadline = Date.now() + budgetMs;

  for (let i = 0; i < books.length && Date.now() < deadline; i += BATCH) {
    const batch = books.slice(i, i + BATCH);
    const q = batch
      .map(b => `(title:"${phrase(b.title.split(':')[0])}" AND author:"${phrase(surname(b.author))}")`)
      .join(' OR ');
    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?${new URLSearchParams({ q, limit: '100', fields: 'title,author_name,first_publish_year' })}`,
        {
          headers: { 'User-Agent': 'CamarilloBookworm/1.0 (www.camarillobookworm.com)' },
          signal: AbortSignal.timeout(Math.max(1000, Math.min(6000, deadline - Date.now()))),
        },
      );
      if (!response.ok) throw new Error(`Open Library ${response.status}`);
      const { docs = [] } = (await response.json()) as {
        docs?: { title: string; author_name?: string[]; first_publish_year?: number }[];
      };

      for (const book of batch) {
        const wanted = titleKey(book.title);
        const by = surname(book.author);
        const found = docs
          .filter(d => d.first_publish_year && titleKey(d.title) === wanted && (d.author_name ?? []).some(a => fold(a).includes(by)))
          .map(d => d.first_publish_year as number);
        if (found.length) years.set(book.isbn, Math.min(...found));
      }
    } catch (error) {
      console.warn('first-published lookup failed:', (error as Error).message);
    }
  }
  return years;
}
