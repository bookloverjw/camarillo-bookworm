/**
 * Seasonal features: collections worth putting on the homepage for a few
 * weeks a year. Each knows its own dates, so the site changes with the
 * calendar without anyone editing it - except Banned Books Week, whose dates
 * the ALA announces each year (see BANNED_BOOKS_WEEK).
 */

export interface SeasonalFeature {
  id: string;
  to: string;
  title: string;
  blurb: string;
  cta: string;
  /** Start and end, inclusive, as YYYY-MM-DD for the given year. */
  dates: (year: number) => [string, string] | null;
  /** Days before the start to begin announcing it. */
  leadDays: number;
}

/** Update when the ALA announces the next Banned Books Week. */
export const BANNED_BOOKS_WEEK: Record<number, { start: string; end: string; theme: string }> = {
  2026: { start: '2026-10-04', end: '2026-10-10', theme: 'Let Books Be' },
};

export const SEASONAL_FEATURES: SeasonalFeature[] = [
  {
    id: 'hispanic-heritage-month',
    to: '/collections/hispanic-heritage-month',
    title: 'Hispanic Heritage Month',
    blurb: 'Pura Belpré Award books by Latino writers and illustrators, from picture books to YA.',
    cta: 'Browse Belpré Award books',
    dates: year => [`${year}-09-15`, `${year}-10-15`],
    leadDays: 0,
  },
  {
    id: 'banned-books-week',
    to: '/collections/banned-books',
    title: 'Banned Books Week',
    blurb: 'Celebrate the freedom to read with the books people keep trying to pull off library shelves.',
    cta: 'Browse banned & challenged books',
    dates: year => (BANNED_BOOKS_WEEK[year] ? [BANNED_BOOKS_WEEK[year].start, BANNED_BOOKS_WEEK[year].end] : null),
    leadDays: 21,
  },
  {
    id: 'read-if-you-dare',
    to: '/collections/read-if-you-dare',
    title: 'Read If You Dare',
    blurb: 'Award-winning horror and gothic classics for spooky season.',
    cta: 'Browse horror',
    dates: year => [`${year}-10-01`, `${year}-10-31`],
    leadDays: 7,
  },
];

export interface ActiveFeature extends SeasonalFeature {
  status: 'now' | 'upcoming';
  range: string;
  theme?: string;
}

/** "October 4–10, 2026". Built by hand: toLocaleDateString for a bare day and year gives "2026 (day: 10)". */
export function formatRange(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T12:00:00`);
  const end = new Date(`${endIso}T12:00:00`);
  const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'long' });
  return start.getMonth() === end.getMonth()
    ? `${month(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
    : `${month(start)} ${start.getDate()} – ${month(end)} ${end.getDate()}, ${end.getFullYear()}`;
}

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** What to feature today, running ones first. Uses local time: a feature starts on the store's calendar day. */
export function activeFeatures(now = new Date()): ActiveFeature[] {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const active: ActiveFeature[] = [];
  for (const f of SEASONAL_FEATURES) {
    const dates = f.dates(now.getFullYear());
    if (!dates) continue;
    const [start, end] = dates;
    const status = today >= start && today <= end ? 'now' : today >= shift(start, -f.leadDays) && today < start ? 'upcoming' : null;
    if (!status) continue;
    active.push({
      ...f, status, range: formatRange(start, end),
      theme: f.id === 'banned-books-week' ? BANNED_BOOKS_WEEK[now.getFullYear()]?.theme : undefined,
    });
  }
  return active.sort((a, b) => (a.status === b.status ? 0 : a.status === 'now' ? -1 : 1));
}
