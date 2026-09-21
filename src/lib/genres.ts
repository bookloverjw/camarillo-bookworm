/**
 * The POS's genre field, made fit to show. It holds a mix of readable names
 * ("Psychology") and store codes ("BIOG", "OCC"), and after the catalogue
 * cleanup some books' genre contradicts their corrected category (Educated
 * is Biography, but its POS genre still says Fiction).
 *
 * Only for display: links and filters keep using the stored value.
 */

const CODES: Record<string, string> = {
  BIOG: 'Biography', HIS: 'History', HSCH: 'History', SCI: 'Science', NAT: 'Nature', CRST: 'Christianity',
  BIB: 'Bibles', OCC: 'Body, Mind & Spirit', SEL: 'Self-Help', HEA: 'Health', CKB: 'Cooking', ART: 'Art',
  POL: 'Politics', BUS: 'Business', BUSN: 'Business', SOC: 'Social Science', SOCI: 'Social Science',
  PSY: 'Psychology', PHI: 'Philosophy', POE: 'Poetry', DRA: 'Drama', TRV: 'Travel', TRVL: 'Travel',
  SPO: 'Sports', SPOR: 'Sports', HUM: 'Humor', HUMR: 'Humor', TRU: 'True Crime', EDU: 'Education',
  GAR: 'Gardening', LAW: 'Law', MED: 'Medical', PER: 'Performing Arts', CRA: 'Crafts', CRFT: 'Crafts',
  COM: 'Computers', LAN: 'Language', DES: 'Design', GNOV: 'Graphic Novels', FANT: 'Fantasy',
  CLAS: 'Classics', KCLA: "Children's Classics", YAN: 'Young Adult Nonfiction', LOCL: 'Local Interest',
  CALI: 'California', SPAN: 'Spanish Language', GRIE: 'Grief', HOL: 'Holiday', HALO: 'Halloween', EAST: 'Easter',
  NON: 'Nonfiction', TRA: 'Travel',
};

// Store-internal codes that mean nothing to a reader (games, merchandise, gifts, video).
const HIDDEN = new Set(['GAM', 'MRCH', 'GFTS', 'VID', 'Office', 'OCC ']);

const FICTION_GENRES = /^(fiction|literary|juvenile fiction|classics|mystery|romance|fantasy|sci-fi|thriller|historical fiction)$/i;
const FICTION_CATEGORIES = new Set(['Fiction', 'Mystery', 'Romance', 'Fantasy', 'Sci-Fi', 'Thriller', 'Historical Fiction', 'Kids', 'Picture Books', 'Chapter Books', 'YA', 'Graphic Novels']);

/** The genre to show beside a book's category, or null when it would only repeat or contradict it. */
export function displayGenre(category: string | undefined, genre: string | undefined): string | null {
  if (!genre || HIDDEN.has(genre)) return null;
  const label = CODES[genre] ?? genre;
  if (category && label.toLowerCase() === category.toLowerCase()) return null;
  if (category && !FICTION_CATEGORIES.has(category) && FICTION_GENRES.test(label)) return null;
  return label;
}
