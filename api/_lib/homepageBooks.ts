/**
 * Assembles the homepage's Bestsellers and New Releases from the NYT Best
 * Sellers API plus our own catalogue.
 *
 * Our catalogue stopped syncing from the POS in February 2026, so on its own
 * it cannot say what is selling now or what came out this quarter - it holds
 * two books published in the last ninety days. The NYT lists are current
 * every week and we look their ISBNs up in the catalogue, so a title we carry
 * links to our own page and price, and one we don't links to Bookshop.org.
 *
 * Files under api/_lib are not exposed as routes; see api/homepage-books.ts.
 */

// The browser client uses these same two values (src/lib/supabase.ts). Both
// are public by design; the customer-facing columns of books are readable by
// anyone.
const SUPABASE_URL = 'https://lildbdxabljkoynvpflu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_h_B4nBpI9hTOycnv4Fj6Tw_epMD62aO';

const NEW_RELEASE_WINDOW_DAYS = 90;
const PER_LIST = 15;

export type Category = 'Fiction' | 'Nonfiction' | 'Kids' | 'YA';
export type Shelf = 'hardcover' | 'paperback' | 'childrens';

export interface HomepageBook {
  isbn: string;
  title: string;
  author: string;
  cover: string | null;
  /** Our books.id when we carry the title, so the card can open our page. */
  catalogId: string | null;
  /** Our price, when we carry it. The NYT does not publish prices. */
  price: number | null;
  /** YYYY-MM-DD, or null if nothing could say. */
  releaseDate: string | null;
  releaseDateSource: 'catalogue' | 'nyt-debut' | null;
  category: Category;
  rank: number | null;
  list: string | null;
  weeksOnList: number | null;
  /** The NYT's one-line description, when the book came from a list. */
  description?: string | null;
}

export interface HomepageBooks {
  /** The date the NYT lists are "as of", for the attribution line. */
  listsDate: string | null;
  bestsellers: Record<Shelf, HomepageBook[]>;
  newReleases: HomepageBook[];
}

// Which NYT lists feed each tab, what each means for New Releases' Fiction /
// Nonfiction / Kids / YA tabs, and a short label for the card - the tab
// already says Hardcover or Paperback, so "#1 \u00b7 Fiction" is enough.
//
// Monthly lists count months, not weeks, in weeks_on_list, so their debut
// date can't be worked out the same way. They fill Bestsellers only.
const LISTS: Record<string, { shelf: Shelf | null; category: Category; label: string; monthly?: boolean }> = {
  'hardcover-fiction': { shelf: 'hardcover', category: 'Fiction', label: 'Fiction' },
  'hardcover-nonfiction': { shelf: 'hardcover', category: 'Nonfiction', label: 'Nonfiction' },
  'trade-fiction-paperback': { shelf: 'paperback', category: 'Fiction', label: 'Fiction' },
  // Weekly until the NYT made it monthly; the old paperback-nonfiction slug
  // no longer appears in the overview.
  'paperback-nonfiction-monthly': { shelf: 'paperback', category: 'Nonfiction', label: 'Nonfiction', monthly: true },
  'picture-books': { shelf: 'childrens', category: 'Kids', label: 'Picture Books' },
  'childrens-middle-grade-hardcover': { shelf: 'childrens', category: 'Kids', label: 'Middle Grade' },
  'series-books': { shelf: 'childrens', category: 'Kids', label: 'Series' },
  'young-adult-hardcover': { shelf: 'childrens', category: 'YA', label: 'Young Adult' },
  // Not a Bestsellers tab, but new titles here belong in New Releases.
  'advice-how-to-and-miscellaneous': { shelf: null, category: 'Nonfiction', label: 'Advice' },
};

interface NytBook {
  rank: number;
  description?: string;
  title: string;
  author: string;
  primary_isbn13: string;
  book_image: string | null;
  weeks_on_list: number;
}

interface NytList {
  list_name_encoded: string;
  display_name: string;
  books: NytBook[];
}

interface CatalogueRow {
  id: string;
  isbn: string;
  title: string;
  author: string;
  price: number;
  list_price?: number | null;
  cover_url: string | null;
  category: string | null;
  publication_date: string | null;
}

/**
 * The NYT sets titles in capitals ("THE WEDDING PEOPLE"). Bring them back to
 * title case, leaving short joining words lower-case unless they lead.
 */
const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
export function titleCase(title: string) {
  return title
    .toLowerCase()
    .split(' ')
    .map((word, i) =>
      i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

const daysAgo = (days: number, from: Date) => {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

/**
 * When a book first appeared on its list, which for a bestseller is almost
 * always its release week. weeks_on_list counts this week as week one.
 *
 * Counted from the end of the sales week the list measures, not the list's
 * cover date: the NYT dates each list about two weeks ahead of the sales it
 * reports, so counting from the cover date put this week's debuts in the
 * future and dropped them from New Releases.
 */
function debutDate(salesWeekEnding: string, weeksOnList: number) {
  const weeks = Math.max(weeksOnList, 1) - 1;
  return daysAgo(weeks * 7, new Date(`${salesWeekEnding}T00:00:00Z`));
}

function catalogueCategory(raw: string | null): Category | null {
  const value = (raw || '').toLowerCase();
  if (value.includes('young adult') || value === 'ya') return 'YA';
  if (value.includes('kid') || value.includes('child') || value.includes('picture') || value.includes('chapter')) return 'Kids';
  if (value.includes('nonfiction') || value.includes('non-fiction')) return 'Nonfiction';
  if (value.includes('fiction')) return 'Fiction';
  return null;
}

async function fetchNytLists(
  apiKey: string,
): Promise<{ date: string | null; salesWeekEnding: string | null; lists: NytList[] }> {
  // One call returns every current list. The API allows 5 calls a minute and
  // 500 a day; the CDN cache in front of this means we make a few a day.
  const res = await fetch(
    `https://api.nytimes.com/svc/books/v3/lists/overview.json?api-key=${encodeURIComponent(apiKey)}`,
  );
  if (!res.ok) throw new Error(`NYT Books API returned ${res.status}`);

  const body = await res.json();
  return {
    date: body?.results?.published_date ?? null,
    salesWeekEnding: body?.results?.bestsellers_date ?? null,
    lists: body?.results?.lists ?? [],
  };
}

async function supabaseSelect(path: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Catalogue lookup failed: ${res.status}`);
  return res.json();
}

// Named columns, not '*': the publishable key may only read the customer-
// facing ones (supabase/books-public-columns-2-lockdown.sql), and asking for
// everything is refused. list_price is created by step 1 of that migration
// if the ISBNdb one has not already.
const CATALOGUE_FIELDS = 'id,isbn,title,author,price,list_price,cover_url,category,publication_date';

export async function buildHomepageBooks(nytApiKey: string, now = new Date()): Promise<HomepageBooks> {
  const { date: listsDate, salesWeekEnding, lists } = await fetchNytLists(nytApiKey);
  const today = now.toISOString().slice(0, 10);
  const windowStart = daysAgo(NEW_RELEASE_WINDOW_DAYS, now);

  const relevant = lists.filter(list => LISTS[list.list_name_encoded]);
  const isbns = [...new Set(relevant.flatMap(list => list.books.map(b => b.primary_isbn13)).filter(Boolean))];

  // What we carry, keyed by ISBN, plus anything in the catalogue itself that
  // came out inside the window - once the POS sync is back, that is where
  // new titles we actually stock will show up.
  const [carried, recentInCatalogue] = await Promise.all([
    isbns.length
      ? (supabaseSelect(`books?select=${CATALOGUE_FIELDS}&isbn=in.(${isbns.join(',')})`) as Promise<CatalogueRow[]>)
      : Promise.resolve([] as CatalogueRow[]),
    supabaseSelect(
      `books?select=${CATALOGUE_FIELDS}&publication_date=gte.${windowStart}` +
        `&publication_date=lte.${today}&isbn=like.97*&order=publication_date.desc&limit=60`,
    ) as Promise<CatalogueRow[]>,
  ]);

  const byIsbn = new Map(carried.map(row => [row.isbn, row]));

  const fromNyt = (book: NytBook, list: NytList): HomepageBook => {
    const ours = byIsbn.get(book.primary_isbn13);
    const meta = LISTS[list.list_name_encoded];
    const nytDebut =
      salesWeekEnding && !meta.monthly ? debutDate(salesWeekEnding, book.weeks_on_list) : null;

    return {
      isbn: book.primary_isbn13,
      title: titleCase(book.title),
      author: book.author,
      // NYT's jacket is current and sized for display; ours is the fallback.
      cover: book.book_image || ours?.cover_url || null,
      catalogId: ours?.id ?? null,
      // Purchases go through Bookshop.org, which charges list price; prefer the
      // publisher's current one over our months-old POS price (the site's
      // displayPrice in src/lib/bookService.ts does the same).
      price: ours ? Number(ours.list_price || ours.price) : null,
      // Our publication date is exact when we have it. The NYT debut is the
      // backstop for the (currently most) titles we don't carry.
      releaseDate: ours?.publication_date ?? nytDebut,
      releaseDateSource: ours?.publication_date ? 'catalogue' : nytDebut ? 'nyt-debut' : null,
      category: meta.category,
      rank: book.rank,
      list: meta.label,
      weeksOnList: book.weeks_on_list,
      description: book.description || null,
    };
  };

  // --- Bestsellers: interleave each shelf's lists by rank -------------------
  // So the Hardcover tab reads Fiction #1, Nonfiction #1, Fiction #2... rather
  // than fifteen novels before the first nonfiction title.
  const bestsellers: Record<Shelf, HomepageBook[]> = { hardcover: [], paperback: [], childrens: [] };
  for (const shelf of Object.keys(bestsellers) as Shelf[]) {
    const shelfLists = relevant.filter(list => LISTS[list.list_name_encoded].shelf === shelf);
    const seen = new Set<string>();
    for (let rank = 1; rank <= PER_LIST; rank++) {
      for (const list of shelfLists) {
        const book = list.books.find(b => b.rank === rank);
        if (book && !seen.has(book.primary_isbn13)) {
          seen.add(book.primary_isbn13);
          bestsellers[shelf].push(fromNyt(book, list));
        }
      }
    }
  }

  // --- New Releases: anything out within the window, newest first -----------
  const releases = new Map<string, HomepageBook>();

  for (const list of relevant) {
    for (const book of list.books) {
      const item = fromNyt(book, list);
      if (item.releaseDate && item.releaseDate >= windowStart && item.releaseDate <= today) {
        releases.set(item.isbn, releases.get(item.isbn) ?? item);
      }
    }
  }

  for (const row of recentInCatalogue) {
    if (releases.has(row.isbn)) continue;
    const category = catalogueCategory(row.category);
    if (!category) continue;
    releases.set(row.isbn, {
      isbn: row.isbn,
      title: row.title,
      author: row.author,
      cover: row.cover_url,
      catalogId: row.id,
      price: Number(row.list_price || row.price),
      releaseDate: row.publication_date,
      releaseDateSource: 'catalogue',
      category,
      rank: null,
      list: null,
      weeksOnList: null,
    });
  }

  const newReleases = [...releases.values()].sort((a, b) =>
    (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''),
  );

  return { listsDate, bestsellers, newReleases };
}
