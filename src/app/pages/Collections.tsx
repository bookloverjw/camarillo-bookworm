import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, BookX, Clapperboard, Award as AwardIcon } from 'lucide-react';
import { BookCover } from '@/app/components/BookCover';
import { getAwards, getCollection, type CollectionBook } from '@/lib/collections';

/**
 * Banned Books Week moves each year, so it lives here rather than being
 * worked out: update it when the ALA announces the next one. The banner shows
 * from three weeks ahead until the week ends.
 */
export const BANNED_BOOKS_WEEK = {
  start: '2026-10-04',
  end: '2026-10-10',
  theme: 'Let Books Be',
  source: 'https://bannedbooksweek.org/',
};

export function bannedBooksWeekStatus(today = new Date()): 'upcoming' | 'now' | null {
  const day = today.toISOString().slice(0, 10);
  const leadIn = new Date(`${BANNED_BOOKS_WEEK.start}T00:00:00Z`);
  leadIn.setUTCDate(leadIn.getUTCDate() - 21);
  if (day >= BANNED_BOOKS_WEEK.start && day <= BANNED_BOOKS_WEEK.end) return 'now';
  if (day >= leadIn.toISOString().slice(0, 10) && day < BANNED_BOOKS_WEEK.start) return 'upcoming';
  return null;
}

/**
 * "October 4–10, 2026". Built by hand: asking toLocaleDateString for just a
 * day and a year gives "2026 (day: 10)".
 */
function weekRange(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T12:00:00`);
  const end = new Date(`${endIso}T12:00:00`);
  const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'long' });
  return start.getMonth() === end.getMonth()
    ? `${month(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
    : `${month(start)} ${start.getDate()} – ${month(end)} ${end.getDate()}, ${end.getFullYear()}`;
}

export const BannedBooksWeekBanner = () => {
  const status = bannedBooksWeekStatus();
  if (!status) return null;
  const range = weekRange(BANNED_BOOKS_WEEK.start, BANNED_BOOKS_WEEK.end);
  return (
    <Link
      to="/collections/banned-books"
      className="block rounded-2xl bg-primary text-white p-6 sm:p-8 hover:bg-primary/95 transition-colors group"
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60 mb-2">
        {status === 'now' ? 'This week' : 'Coming up'} · {range}
      </p>
      <h2 className="text-2xl sm:text-3xl font-serif font-bold mb-2">Banned Books Week: “{BANNED_BOOKS_WEEK.theme}”</h2>
      <p className="text-white/80 max-w-2xl mb-4">
        Celebrate the freedom to read with the books people keep trying to pull off library shelves.
      </p>
      <span className="inline-flex items-center text-sm font-bold group-hover:underline">
        Browse banned & challenged books <ArrowRight size={16} className="ml-1" />
      </span>
    </Link>
  );
};

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

export const Collections = () => {
  const [tiles, setTiles] = useState<Tile[]>([]);

  useEffect(() => {
    Promise.all([
      getAwards().catch(() => null),
      getCollection('banned-books').catch(() => null),
      getCollection('the-book-was-better').catch(() => null),
    ]).then(([awards, banned, screen]) => {
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
      for (const [c, icon] of [[banned, BookX], [screen, Clapperboard]] as const) {
        if (c) out.push({ to: `/collections/${c.slug}`, title: c.title, tagline: c.tagline, icon,
                          covers: withCovers(c.sections.flatMap(s => s.books)) });
      }
      setTiles(out);
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="text-center mb-12">
        <h1 className="section-title">Collections</h1>
        <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
          Shelves we've pulled together — prize winners, banned books, and the books behind this year's films.
        </p>
      </div>

      <div className="mb-12"><BannedBooksWeekBanner /></div>

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
