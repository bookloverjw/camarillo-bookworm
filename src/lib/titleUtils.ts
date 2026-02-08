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
