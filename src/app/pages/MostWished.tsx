import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Heart, Loader2 } from 'lucide-react';
import { CollectionBookCard } from '@/app/components/CollectionBookCard';
import { getMostWished, type MostWishedBook } from '@/lib/mostWished';

/**
 * What readers are saving. A book only says how many readers want it once
 * three do - a count of one on an obscure title says a little too much
 * about one person.
 */
const readers = (n: number) => (n >= 3 ? `${n} readers want this` : undefined);

export const MostWished = () => {
  const [books, setBooks] = useState<MostWishedBook[] | null>(null);

  useEffect(() => { getMostWished().then(setBooks); }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <Link to="/collections" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-8">
        <ArrowLeft size={16} /> All collections
      </Link>
      <div className="text-center mb-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">From our readers</p>
        <h1 className="section-title">Most Wished For</h1>
        <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
          The books our customers are saving to their wishlists. Tap the heart on any book to add your own.
        </p>
      </div>

      {books === null && (
        <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground"><Loader2 className="animate-spin text-primary" size={24} /> Loading…</div>
      )}

      {books && books.length === 0 && (
        <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
          <Heart size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
          <h2 className="text-xl font-serif font-bold text-primary mb-2">Nothing here yet</h2>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">Be the first: sign in and tap the heart on a book you're hoping to read.</p>
          <Link to="/shop" className="bg-primary text-white px-8 py-3 rounded-full font-bold">Browse the shop</Link>
        </div>
      )}

      {books && books.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-10">
          {books.map((b, i) => (
            <CollectionBookCard
              key={b.isbn}
              book={{ title: b.title, author: b.author, isbn: b.isbn, cover: b.cover ?? undefined, catalogId: b.catalogId ?? undefined }}
              eyebrow={`#${i + 1}`}
              footer={readers(b.wishers) && (
                <p className="inline-flex items-center gap-1 text-[11px] text-red-500 mt-1.5"><Heart size={11} className="fill-current" /> {readers(b.wishers)}</p>
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};
