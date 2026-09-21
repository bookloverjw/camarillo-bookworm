/**
 * Seasonal features: collections worth putting on the homepage for a few
 * weeks a year. Each knows its own dates - fixed, or worked out for the year
 * (MLK Day, Easter, Thanksgiving) - so the site changes with the calendar
 * without anyone editing it. Two need dates entered: Banned Books Week, which
 * the ALA announces each year, and Hanukkah (see HANUKKAH).
 */

export interface SeasonalFeature {
  id: string;
  /** The collection whose books fill the homepage section while it's running. */
  collection: string;
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

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Hanukkah moves on the Gregorian calendar: first candle and last day (hebcal.com). */
export const HANUKKAH: Record<number, [string, string]> = {
  2026: ['2026-12-04', '2026-12-12'],
  2027: ['2027-12-24', '2028-01-01'],
  2028: ['2028-12-12', '2028-12-20'],
  2029: ['2029-12-01', '2029-12-09'],
  2030: ['2030-12-20', '2030-12-28'],
  2031: ['2031-12-09', '2031-12-17'],
};

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** The nth given weekday (0 = Sunday) of a month (1-12); n = -1 for the last. */
function nthWeekday(year: number, month: number, weekday: number, n: number) {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return isoDay(year, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDate = new Date(Date.UTC(year, month, 0));
  const back = (lastDate.getUTCDay() - weekday + 7) % 7;
  return isoDay(year, month, lastDate.getUTCDate() - back);
}

/** Western Easter Sunday (the anonymous Gregorian algorithm). */
export function easter(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDay(year, month, day);
}

const lastDayOf = (year: number, month: number) => isoDay(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate());

const feature = (id: string, title: string, blurb: string, dates: SeasonalFeature['dates'], leadDays = 0, cta?: string): SeasonalFeature => ({
  id, collection: id, to: `/collections/${id}`, title, blurb, dates, leadDays, cta: cta ?? `See the full ${title} collection`,
});

/** The year on the store's calendar, January to December. */
export const SEASONAL_FEATURES: SeasonalFeature[] = [
  feature('new-year-new-reads', 'New Year, New Reads', 'Books for better habits, fresh starts and second chances.',
    year => [`${year}-12-26`, `${year + 1}-01-31`]),
  feature('martin-luther-king-jr-day', 'Martin Luther King Jr. Day', "Dr. King's own words, the history of the movement, and books for young readers.",
    year => { const day = nthWeekday(year, 1, 1, 3); return [shift(day, -7), day]; }),
  feature('black-history-month', 'Black History Month', 'Landmark fiction, history and memoir by Black writers, and prizewinning books for young readers.',
    year => [`${year}-02-01`, lastDayOf(year, 2)]),
  feature('irish-writers', "St. Patrick's Day: Irish Writers", 'Booker winners, bestsellers and classics from Ireland.',
    year => [`${year}-03-01`, `${year}-03-17`], 0, 'See the full Irish Writers collection'),
  feature('womens-history-month', "Women's History Month", 'Remarkable women, and the books that tell their stories.',
    year => [`${year}-03-01`, `${year}-03-31`]),
  feature('easter', 'Easter', 'Books for the Easter basket, rabbit classics, and reading for the season.',
    year => { const day = easter(year); return [shift(day, -21), day]; }, 0, 'See the full Easter & Spring collection'),
  feature('national-poetry-month', 'National Poetry Month', 'Pulitzer-winning poets, the classics, and poetry for young readers.',
    year => [`${year}-04-01`, `${year}-04-30`]),
  feature('books-about-books', 'Independent Bookstore Day', 'Celebrate the last Saturday in April with books about bookshops, libraries and readers.',
    year => { const day = nthWeekday(year, 4, 6, -1); return [shift(day, -6), day]; }, 14, 'See our Books About Books collection'),
  feature('aapi-heritage-month', 'AAPI Heritage Month', 'Novels, memoir and history by Asian American and Pacific Islander writers.',
    year => [`${year}-05-01`, `${year}-05-31`], 0, 'See the full AAPI Heritage Month collection'),
  feature('graduation', 'Graduation Gifts', 'Books grads actually keep: timeless advice and practical guides to life after school.',
    year => [`${year}-05-01`, `${year}-06-20`], 0, 'See all our graduation gift ideas'),
  feature('pride-month', 'Pride Month', 'LGBTQ+ novels, memoir and history, and books for young readers.',
    year => [`${year}-06-01`, `${year}-06-30`]),
  feature('summer-reading', 'Summer Reading', 'Beach reads, page-turners, and summer reading for kids.',
    year => [`${year}-06-15`, `${year}-08-15`]),
  feature('back-to-school', 'Back to School', 'First-day picture books, classroom favorites, and books for teens heading back.',
    year => [`${year}-07-20`, `${year}-09-14`]),
  {
    id: 'hispanic-heritage-month',
    collection: 'hispanic-heritage-month',
    to: '/collections/hispanic-heritage-month',
    title: 'Hispanic Heritage Month',
    blurb: 'Fiction, nonfiction and poetry by Latino and Latin American writers, and Pura Belpré Award books for young readers.',
    cta: 'See the full Hispanic Heritage Month collection',
    dates: year => [`${year}-09-15`, `${year}-10-15`],
    leadDays: 0,
  },
  {
    id: 'banned-books-week',
    collection: 'banned-books',
    to: '/collections/banned-books',
    title: 'Banned Books Week',
    blurb: 'Celebrate the freedom to read with the books people keep trying to pull off library shelves.',
    cta: 'Browse banned & challenged books',
    dates: year => (BANNED_BOOKS_WEEK[year] ? [BANNED_BOOKS_WEEK[year].start, BANNED_BOOKS_WEEK[year].end] : null),
    leadDays: 21,
  },
  {
    id: 'read-if-you-dare',
    collection: 'read-if-you-dare',
    to: '/collections/read-if-you-dare',
    title: 'Read If You Dare',
    blurb: 'Award-winning horror and gothic classics for spooky season.',
    cta: 'See the full Read If You Dare collection',
    // Retail's spooky season starts mid-September, not on October 1.
    dates: year => [`${year}-09-15`, `${year}-10-31`],
    leadDays: 7,
  },
  feature('native-american-heritage-month', 'Native American Heritage Month',
    'Fiction, poetry, history and books for young readers by Native American and Indigenous writers.',
    year => [`${year}-11-01`, `${year}-11-30`]),
  feature('thanksgiving', 'Thanksgiving', 'Picture books for the kids\' table, gratitude and history, and cookbooks for the big day.',
    year => [`${year}-11-01`, nthWeekday(year, 11, 4, 4)]),
  feature('holiday-gift-guide', 'Holiday Gift Guide', "This year's prizewinners, award-winning books for kids, graphic novels and the holiday classics.",
    year => [`${year}-11-01`, `${year}-12-24`], 0, 'See the full Holiday Gift Guide'),
  feature('hanukkah', 'Hanukkah', 'Eight nights, eight great books: picture books, middle grade and Jewish fiction.',
    year => (HANUKKAH[year] ? [shift(HANUKKAH[year][0], -10), HANUKKAH[year][1]] : null)),
  feature('christmas', 'Christmas', 'Picture books, family read-alouds and cozy holiday novels.',
    year => [`${year}-12-01`, `${year}-12-25`]),
];

export interface ActiveFeature extends SeasonalFeature {
  status: 'now' | 'upcoming';
  range: string;
  /** Days from start to end, for ranking overlapping features. */
  length: number;
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


/** What to feature today, running ones first. Uses local time: a feature starts on the store's calendar day. */
export function activeFeatures(now = new Date()): ActiveFeature[] {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const active: ActiveFeature[] = [];
  const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000;
  for (const f of SEASONAL_FEATURES) {
    // Last year's dates too: New Year's and some Hanukkahs run into January.
    for (const year of [now.getFullYear() - 1, now.getFullYear()]) {
      const dates = f.dates(year);
      if (!dates) continue;
      const [start, end] = dates;
      const status = today >= start && today <= end ? 'now' : today >= shift(start, -f.leadDays) && today < start ? 'upcoming' : null;
      if (!status) continue;
      active.push({
        ...f, status, range: formatRange(start, end), length: days(start, end),
        theme: f.id === 'banned-books-week' ? BANNED_BOOKS_WEEK[year]?.theme : undefined,
      });
      break;
    }
  }
  // Running first; among those, the most specific (shortest) occasion first,
  // so Hanukkah or Thanksgiving leads over a month-long feature.
  return active.sort((a, b) =>
    a.status !== b.status ? (a.status === 'now' ? -1 : 1) : a.length - b.length);
}
