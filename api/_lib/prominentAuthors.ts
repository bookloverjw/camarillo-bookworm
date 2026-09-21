/**
 * The standing list of perennial bestsellers. Coming Soon looks for their
 * forthcoming books; New Releases uses it to decide whether a book that
 * isn't on a best seller list is still by someone readers ask for by name.
 * (Authors on the current NYT lists count as prominent on their own.)
 */
export const PERENNIAL = [
  'Louise Penny', 'Stephen King', 'Brandon Sanderson', 'Emily Henry', 'Kristin Hannah', 'Freida McFadden',
  'Rebecca Yarros', 'Sarah J. Maas', 'Colleen Hoover', 'Michael Connelly', 'John Grisham', 'Jodi Picoult',
  'Liane Moriarty', 'Richard Osman', 'Taylor Jenkins Reid', 'Sally Rooney', 'Barbara Kingsolver',
  'Louise Erdrich', 'Ann Patchett', 'Rick Riordan', 'Dav Pilkey', 'Jeff Kinney', 'Andy Weir',
  'Martha Wells', 'Adrian Tchaikovsky', 'Matt Dinniman', 'Erik Larson', 'David Grann', 'Kate Quinn',
  'Fredrik Backman', 'Lucy Foley', 'Ruth Ware', 'Harlan Coben', 'Lee Child', 'David Baldacci',
  'Abby Jimenez', 'Ali Hazelwood', 'Mick Herron', 'Tana French', 'R. F. Kuang', 'Holly Jackson',
  'Jennifer Lynn Barnes', 'Suzanne Collins', 'Percival Everett', 'Kazuo Ishiguro', 'Kiley Reid',
];

/** Lower-case, unaccented, punctuation-free: "R.F. Kuang" and "R. F. Kuang" both become "r f kuang". */
export const foldName = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
