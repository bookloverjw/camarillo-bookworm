/**
 * Split a book title into main title and subtitle.
 * Handles common bibliographic separators: ": ", " - ", " — ", " – "
 * If no separator is found, the full string is the title and subtitle is undefined.
 */
export function splitTitle(fullTitle: string): { title: string; subtitle?: string } {
  // Try separators in order of preference
  const separators = [': ', ' - ', ' — ', ' – '];
  for (const sep of separators) {
    const idx = fullTitle.indexOf(sep);
    if (idx > 0) {
      return {
        title: fullTitle.slice(0, idx),
        subtitle: fullTitle.slice(idx + sep.length),
      };
    }
  }
  return { title: fullTitle };
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

/**
 * Some catalogue imports arrive in capitals ("DAY THE CRAYONS CAME HOME").
 * Bring those back to title case; anything with lower-case letters already
 * is left exactly as it is.
 */
export function fixAllCapsTitle(title: string): string {
  if (title !== title.toUpperCase() || !/[A-Z]{2}/.test(title)) return title;
  return title
    .toLowerCase()
    .split(' ')
    .map((word, i) =>
      i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}
