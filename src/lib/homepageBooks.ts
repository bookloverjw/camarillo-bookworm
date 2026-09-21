import type { HomepageBooks } from '../../api/_lib/homepageBooks';

export type { HomepageBook, HomepageBooks, Shelf } from '../../api/_lib/homepageBooks';

/**
 * The NYT-backed homepage lists (see api/homepage-books.ts), or null when they
 * aren't available: no NYT key configured, the NYT having a bad day, or a
 * local `vite` server, which doesn't serve /api. Callers fall back to our own
 * catalogue, so the homepage never shows an empty shelf.
 */
export async function getHomepageBooks(): Promise<HomepageBooks | null> {
  try {
    const res = await fetch('/api/homepage-books');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
