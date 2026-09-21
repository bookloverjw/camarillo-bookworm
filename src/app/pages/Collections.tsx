import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  BookX, Clapperboard, Award as AwardIcon, Ghost, Sun, Users, Sparkles, Library, MapPin, Feather, Gift, CalendarDays,
  PartyPopper, Megaphone, Clover, Venus, Egg, PenLine, BookOpen, Flower2, GraduationCap, Rainbow, Umbrella, Backpack,
  Drumstick, Flame, TreePine,
} from 'lucide-react';
import { BookCover } from '@/app/components/BookCover';
import { SeasonalBanners } from '@/app/components/SeasonalBanners';
import { getAwards, getCollection, type CollectionBook } from '@/lib/collections';
import { SEASONAL_FEATURES } from '@/lib/seasons';

interface Tile {
  to: string;
  title: string;
  tagline: string;
  icon: React.ElementType;
  covers: CollectionBook[];
}

const CoverStrip = ({ books }: { books: CollectionBook[] }) => (
  <div className="flex -space-x-6 mb-6">
    {books.slice(0, 5).map((b, i) => (
      <div
        key={`${b.title}-${i}`}
        className="w-20 aspect-[2/3] rounded shadow-md overflow-hidden ring-2 ring-background bg-muted/40"
        style={{ zIndex: 10 - i }}
      >
        <BookCover src={b.cover} isbn={b.isbn} title={b.title} author={b.author} className="w-full h-full object-cover" />
      </div>
    ))}
  </div>
);

// Books with a picture make a better stack than placeholders.
const withCovers = (books: CollectionBook[]) => books.filter(b => b.cover).concat(books.filter(b => !b.cover));

// Year-round lists, in the order the index shows them.
const CURATED: [string, React.ElementType][] = [
  ['book-club-picks', Users],
  ['banned-books', BookX],
  ['the-book-was-better', Clapperboard],
  ['series-starters', Library],
  ['debut-novels', Sparkles],
  ['california-writers', MapPin],
  ['books-about-books', BookOpen],
];

const SEASONAL_ICONS: Record<string, React.ElementType> = {
  'new-year-new-reads': PartyPopper, 'martin-luther-king-jr-day': Megaphone, 'black-history-month': Megaphone,
  'irish-writers': Clover, 'womens-history-month': Venus, easter: Egg, 'national-poetry-month': PenLine,
  'aapi-heritage-month': Flower2, graduation: GraduationCap, 'pride-month': Rainbow, 'summer-reading': Umbrella,
  'back-to-school': Backpack, 'hispanic-heritage-month': Sun, 'read-if-you-dare': Ghost,
  'native-american-heritage-month': Feather, thanksgiving: Drumstick, 'holiday-gift-guide': Gift, hanukkah: Flame,
  christmas: TreePine,
};

/** Seasonal collections, starting with whatever comes up next on the calendar. */
function seasonalInCalendarOrder(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const seen = new Set(CURATED.map(([slug]) => slug));
  const next = SEASONAL_FEATURES.flatMap(f => {
    if (seen.has(f.collection)) return [];
    seen.add(f.collection);
    const upcoming = [now.getFullYear(), now.getFullYear() + 1]
      .map(y => f.dates(y)).find(d => d && d[1] >= today);
    return upcoming ? [{ slug: f.collection, start: upcoming[0] }] : [];
  });
  return next.sort((a, b) => a.start.localeCompare(b.start)).map(x => x.slug);
}

export const Collections = () => {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [seasonal, setSeasonal] = useState<Tile[]>([]);

  useEffect(() => {
    const toTile = (icon: React.ElementType) => (c: Awaited<ReturnType<typeof getCollection>> | null): Tile | null =>
      c && { to: `/collections/${c.slug}`, title: c.title, tagline: c.tagline, icon, covers: withCovers(c.sections.flatMap(s => s.books)) };

    Promise.all([
      getAwards().catch(() => null),
      ...CURATED.map(([slug, icon]) => getCollection(slug).then(toTile(icon)).catch(() => null)),
    ]).then(([awards, ...curated]) => {
      const out: Tile[] = [];
      if (awards && 'results' in awards) {
        const latestYear = Math.max(...awards.results.map(r => r.year));
        const recentWinners = awards.results.filter(r => r.result === 'winner' && r.year >= latestYear - 1).map(r => r.book);
        out.push({
          to: '/collections/awards', title: 'Award Winners', icon: AwardIcon,
          tagline: 'Pulitzer, National Book Award, Booker, Hugo, Newbery and more — a decade of winners and finalists.',
          covers: withCovers(recentWinners),
        });
      }
      setTiles([...out, ...(curated as (Tile | null)[]).filter((t): t is Tile => !!t)]);
    });

    Promise.all(seasonalInCalendarOrder().map(slug =>
      getCollection(slug).then(toTile(SEASONAL_ICONS[slug] ?? CalendarDays)).catch(() => null),
    )).then(found => setSeasonal(found.filter((t): t is Tile => !!t)));
  }, []);

  const grid = (list: Tile[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {list.map(tile => {
        const Icon = tile.icon;
        return (
          <Link key={tile.to} to={tile.to} className="group rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-lg transition-all">
            <CoverStrip books={tile.covers} />
            <div className="flex items-center gap-2 text-accent mb-2"><Icon size={18} /></div>
            <h2 className="text-xl font-serif font-bold text-primary mb-2 group-hover:underline">{tile.title}</h2>
            <p className="text-sm text-muted-foreground">{tile.tagline}</p>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="text-center mb-12">
        <h1 className="section-title">Collections</h1>
        <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
          Shelves we've pulled together — prize winners, book club picks, series worth starting, banned books, seasonal reads, and the books behind this year's films.
        </p>
      </div>

      <SeasonalBanners className="mb-12" />

      {grid(tiles)}

      {seasonal.length > 0 && (
        <>
          <h2 className="section-title text-center mt-20 mb-3">Through the Year</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">
            Seasonal shelves, starting with what's coming up next.
          </p>
          {grid(seasonal)}
        </>
      )}
    </div>
  );
};
