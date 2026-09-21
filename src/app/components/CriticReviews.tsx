import React, { useEffect, useState } from 'react';
import { BookmarksReviews } from '@/app/components/BookmarksReviews';

interface Summary {
  hasReviews: boolean;
  /** The edition Book Marks reviewed - often the hardcover, not the copy we stock. */
  isbn?: string;
  verdict?: string | null;
  count?: number;
}

const cache = new Map<string, Promise<Summary>>();

/** Ask /api/critic-reviews once per ISBN per page load. Failure reads as "none". */
function checkReviews(isbn: string): Promise<Summary> {
  if (!cache.has(isbn)) {
    cache.set(
      isbn,
      fetch(`/api/critic-reviews?isbn=${encodeURIComponent(isbn)}`)
        .then(r => (r.ok ? r.json() : { hasReviews: false }))
        .catch(() => ({ hasReviews: false })),
    );
  }
  return cache.get(isbn)!;
}

const VERDICT_STYLE: Record<string, string> = {
  Rave: 'bg-emerald-600 text-white',
  Positive: 'bg-emerald-100 text-emerald-900',
  Mixed: 'bg-amber-100 text-amber-900',
  Pan: 'bg-rose-100 text-rose-900',
};

/**
 * Critic reviews from Book Marks, shown only when Book Marks has any: its
 * widget renders an empty box otherwise, which is what most books got.
 */
export const CriticReviews = ({ isbn, compact = false }: { isbn?: string; compact?: boolean }) => {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    setSummary(null);
    if (!isbn) return;
    let live = true;
    checkReviews(isbn).then(s => live && setSummary(s));
    return () => { live = false; };
  }, [isbn]);

  if (!isbn || !summary?.hasReviews) return null;

  return (
    <div>
      <div className={`flex items-center justify-between gap-3 border-b border-border pb-2 ${compact ? 'mb-3' : 'mb-4'}`}>
        <h3 className={`font-bold text-primary ${compact ? 'text-xs uppercase tracking-widest text-muted-foreground' : 'text-lg'}`}>
          Critic Reviews
        </h3>
        {summary.verdict && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${VERDICT_STYLE[summary.verdict] ?? 'bg-muted'}`}>
            {summary.verdict}
            {summary.count ? ` · ${summary.count} review${summary.count === 1 ? '' : 's'}` : ''}
          </span>
        )}
      </div>
      <BookmarksReviews isbn={summary.isbn ?? isbn} />
    </div>
  );
};
