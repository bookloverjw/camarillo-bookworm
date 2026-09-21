import React, { useEffect, useState } from 'react';
import { Award as AwardIcon } from 'lucide-react';
import { getAwardIndex, type AwardBadge as Badge } from '@/lib/collections';

/**
 * An award's seal where we have one, a text ribbon where we don't.
 *
 * Seals sit on a white plate: several are black line art (the Eisner, the
 * Hugo rocket) that would vanish against the dark theme.
 *
 * The ALA seals (Newbery, Caldecott, Printz, Belpré) are the gold winner
 * medals, so they appear on winners only - honor books get a different,
 * silver seal, which we don't have, and show the ribbon instead. The ALA
 * restricts reproduction of its seals; the store has chosen to show them on
 * genuine winners, as booksellers commonly do.
 */
export const AwardSeal = ({ badge, size = 'md' }: { badge: Badge; size?: 'sm' | 'md' }) => {
  const dim = size === 'sm' ? 'w-9 h-9' : 'w-16 h-16';
  const title = `${badge.label}, ${badge.year}`;

  if (badge.seal) {
    return (
      <span className={`${dim} shrink-0 inline-flex items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 p-0.5`} title={title}>
        <img src={badge.seal} alt={title} className="w-full h-full object-contain" loading="lazy" />
      </span>
    );
  }

  return (
    <span
      className={`${dim} shrink-0 inline-flex flex-col items-center justify-center rounded-full text-center leading-none shadow-sm ring-1 ${
        badge.result === 'winner'
          ? 'bg-[#B8962E] text-white ring-[#9C7E22]'
          : 'bg-white text-[#7A6420] ring-[#B8962E]'
      }`}
      title={title}
    >
      <AwardIcon size={size === 'sm' ? 12 : 18} className="mb-0.5" />
      {size === 'md' && (
        <span className="text-[7px] font-bold uppercase tracking-wider px-1">
          {badge.result === 'winner' ? 'Winner' : badge.award.finalistLabel}
        </span>
      )}
    </span>
  );
};

/** The awards section on a book page. Renders nothing for an unawarded book. */
export const BookAwards = ({
  id, isbn, author, title, compact = false,
}: { id?: string; isbn?: string; author?: string; title?: string; compact?: boolean }) => {
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    let live = true;
    getAwardIndex()
      .then(index => live && setBadges(index.forBook({ id, isbn, author, title })))
      .catch(() => {}); // awards are a garnish; a failed load just shows none
    return () => { live = false; };
  }, [id, isbn, author, title]);

  if (badges.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Awards</p>
      <ul className="space-y-2.5">
        {badges.map(b => (
          <li key={`${b.award.id}-${b.year}`} className="flex items-center gap-3">
            <AwardSeal badge={b} />
            <div className="text-sm leading-tight">
              <p className="font-bold text-primary">{b.label}</p>
              <p className="text-muted-foreground">
                {b.award.id === 'nobel' ? `Laureate, ${b.year}` : `${b.award.category}, ${b.year}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
