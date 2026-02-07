/**
 * Split a book title into main title and subtitle.
 * Splits on the first colon followed by a space (e.g. "1929: Inside the Greatest Crash…").
 * If no colon separator is found, the full string is the title and subtitle is undefined.
 */
export function splitTitle(fullTitle: string): { title: string; subtitle?: string } {
  const idx = fullTitle.indexOf(': ');
  if (idx === -1) {
    return { title: fullTitle };
  }
  return {
    title: fullTitle.slice(0, idx),
    subtitle: fullTitle.slice(idx + 2),
  };
}
