import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BookX, Clapperboard, Award as AwardIcon, Ghost, Sun } from 'lucide-react';
import { BookCover } from '@/app/components/BookCover';
import { SeasonalBanners } from '@/app/components/SeasonalBanners';
import { getAwards, getCollection, type CollectionBook } from '@/lib/collections';

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

// The curated lists, in the order the index shows them.
const CURATED: [string, React.ElementType][] = [
  ['banned-books', BookX],
  ['the-book-was-better', Clapperboard],
  ['hispanic-heritage-month', Sun],
  ['read-if-you-dare', Ghost],
];

export const Collections = () => {
  const [tiles, setTiles] = useState<Tile[]>([]);

  useEffect(() => {
    Promise.all([
      getAwards().catch(() => null),
      ...CURATED.map(([slug]) => getCollection(slug).catch(() => null)),
    ]).then(([awards, ...curated]) => {
      const out: Tile[] = [];
      if (awards) {
        const latestYear = Math.max(...awards.results.map(r => r.year));
        const recentWinners = awards.results.filter(r => r.result === 'winner' && r.year >= latestYear - 1).map(r => r.book);
        out.push({
          to: '/collections/awards', title: 'Award Winners', icon: AwardIcon,
          tagline: 'Pulitzer, National Book Award, Booker, Hugo, Newbery and more — a decade of winners and finalists.',
          covers: withCovers(recentWinners),
        });
      }
      curated.forEach((c, i) => {
        if (c) out.push({ to: `/collections/${c.slug}`, title: c.title, tagline: c.tagline, icon: CURATED[i][1],
                          covers: withCovers(c.sections.flatMap(s => s.books)) });
      });
      setTiles(out);
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="text-center mb-12">
        <h1 className="section-title">Collections</h1>
        <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
          Shelves we've pulled together — prize winners, banned books, seasonal reads, and the books behind this year's films.
        </p>
      </div>

      <SeasonalBanners className="mb-12" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tiles.map(tile => {
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
    </div>
  );
};
