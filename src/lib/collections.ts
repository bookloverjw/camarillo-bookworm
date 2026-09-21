/**
 * Curated collections - award winners, banned books, page-to-screen - and the
 * award badges that follow a book around the site.
 *
 * The data lives in public/collections/*.json rather than the bundle: the
 * award results alone are ~700 entries, and only a few pages need them. Each
 * file is fetched once and kept for the life of the page.
 *
 * Every list is compiled from a named source (each file carries it) and
 * matched to the catalogue by title and author, so a book we carry opens our
 * own page and one we don't goes to Bookshop.org.
 */

export interface CollectionBook {
  title: string;
  author: string;
  /** Our books.id when we carry it. */
  catalogId?: string;
  isbn?: string;
  cover?: string;
  /** A line of context: "Most challenged 5 times", "Film, 2025"... */
  note?: string;
}

export interface CuratedCollection {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  source?: { name: string; url: string };
  /** For collections drawn from more than one place. */
  sources?: { name: string; url: string }[];
  sections: { title: string; subtitle?: string; books: CollectionBook[] }[];
}

export type AwardResult = 'winner' | 'finalist';

export interface Award {
  id: string;
  name: string;
  category: string;
  /** What this award calls its runners-up: Finalist, Honor, Shortlist, Nominee. */
  finalistLabel: string;
  seal: { winner?: string; finalist?: string };
  source: string;
}

export interface AwardEntry {
  award: string;
  year: number;
  result: AwardResult;
  book: CollectionBook;
  /**
   * A seal for this year only, overriding the award's own. The Booker was the
   * Man Booker Prize until 2019, so those years carry the Man Booker logo.
   */
  seal?: string;
  /** The prize's name that year, where it differs: "Man Booker Prize" until 2019. */
  awardName?: string;
}

/** The seal for one result: its own override, else the award's for that result. */
export function sealFor(award: Award, entry: Pick<AwardEntry, 'result' | 'seal'>) {
  return sealUrl(entry.seal ?? (entry.result === 'winner' ? award.seal.winner : award.seal.finalist));
}

export interface AwardsData {
  awards: Award[];
  results: AwardEntry[];
  nobel: { year: number; author: string }[];
  verifiedNote: string;
}

/** One badge on one book: "Pulitzer Prize Winner, 2025". */
export interface AwardBadge {
  award: Award;
  year: number;
  result: AwardResult;
  label: string;
  seal?: string;
}

const cache = new Map<string, Promise<unknown>>();

function load<T>(file: string): Promise<T> {
  if (!cache.has(file)) {
    cache.set(
      file,
      fetch(`/collections/${file}`).then(res => {
        if (!res.ok) throw new Error(`${file}: ${res.status}`);
        return res.json();
      }),
    );
  }
  return cache.get(file) as Promise<T>;
}

export const getCollection = (slug: string) => load<CuratedCollection>(`${slug}.json`);
export const getAwards = () => load<AwardsData>('awards.json');

export const sealUrl = (file?: string) => (file ? `/awards/${file}` : undefined);

export function badgeLabel(award: Award, result: AwardResult, name = award.name) {
  return `${name} ${result === 'winner' ? 'Winner' : award.finalistLabel}`;
}

// Names are compared with accents and punctuation folded away, so "Han Kang"
// and "HAN KANG" agree, but only whole names: a surname alone would hand a
// Nobel badge to every other author called Kang.
const foldName = (name: string) =>
  name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * A title reduced to what two records of the same book share: the main title
 * without subtitle, series notes, "A Novel", award stickers the POS folds in,
 * punctuation or a leading article.
 */
function foldTitle(title: string) {
  return title
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .split(':')[0].replace(/\(.*$/, '')
    .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/ (a|an) (novel|memoir|thriller|graphic novel|novel in verse|mystery|story)\b.*$/, '')
    .replace(/ (a )?(printz|newbery|caldecott|national book|pulitzer|booker|hugo|edgar|eisner)\b.*$/, '')
    .replace(/^(the|a|an) /, '')
    .trim();
}

/** Every surname in a byline: "Kai Bird and Martin J. Sherwin" -> bird, sherwin. */
function surnames(author: string) {
  return author
    .replace(/\(.*?\)/g, '')
    .split(/,| and | & |;/)
    .map(part => foldName(part).split(' ').filter(w => !['jr', 'sr', 'ii', 'iii'].includes(w)).pop())
    .filter((s): s is string => !!s && s.length > 1);
}

export interface AwardIndex {
  /**
   * By catalogue id or ISBN first; failing those, by title and author, so an
   * award still shows on another edition than the one the award list names.
   */
  forBook(book: { id?: string; isbn?: string; author?: string; title?: string }): AwardBadge[];
}

let indexPromise: Promise<AwardIndex> | null = null;

/** Look up a catalogue book's awards by id or ISBN, plus its author's Nobel. */
export function getAwardIndex(): Promise<AwardIndex> {
  indexPromise ??= getAwards().then(data => {
    const byAward = new Map(data.awards.map(a => [a.id, a]));
    const byKey = new Map<string, AwardEntry[]>();
    const add = (key: string | undefined, entry: AwardEntry) => {
      if (!key) return;
      byKey.set(key, [...(byKey.get(key) ?? []), entry]);
    };
    for (const entry of data.results) {
      add(entry.book.catalogId && `id:${entry.book.catalogId}`, entry);
      add(entry.book.isbn && `isbn:${entry.book.isbn}`, entry);
      const t = foldTitle(entry.book.title);
      if (t) for (const sn of surnames(entry.book.author)) add(`t:${t}|${sn}`, entry);
    }
    const nobel = new Map(data.nobel.map(n => [foldName(n.author), n.year]));
    const nobelAward: Award = {
      id: 'nobel', name: 'Nobel Prize in Literature', category: 'Laureate',
      finalistLabel: '', seal: {}, source: 'https://www.nobelprize.org/prizes/literature/',
    };

    return {
      forBook({ id, isbn, author, title }) {
        const entries = [...(byKey.get(`id:${id}`) ?? []), ...(byKey.get(`isbn:${isbn}`) ?? [])];
        if (title && author) {
          const t = foldTitle(title);
          for (const sn of surnames(author)) entries.push(...(byKey.get(`t:${t}|${sn}`) ?? []));
        }
        const seen = new Set<string>();
        const badges: AwardBadge[] = [];
        for (const e of entries) {
          const key = `${e.award}|${e.year}`;
          const award = byAward.get(e.award);
          if (!award || seen.has(key)) continue;
          seen.add(key);
          badges.push({
            award, year: e.year, result: e.result,
            label: badgeLabel(award, e.result, e.awardName),
            seal: sealFor(award, e),
          });
        }
        const laureateYear = author ? nobel.get(foldName(author)) : undefined;
        if (laureateYear) {
          badges.push({ award: nobelAward, year: laureateYear, result: 'winner', label: 'Nobel Prize in Literature' });
        }
        // Wins before nominations, newest first.
        return badges.sort((a, b) =>
          a.result !== b.result ? (a.result === 'winner' ? -1 : 1) : b.year - a.year,
        );
      },
    };
  });
  return indexPromise;
}
