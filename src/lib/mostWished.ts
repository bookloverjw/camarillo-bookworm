export interface MostWishedBook {
  isbn: string;
  title: string;
  author: string;
  cover: string | null;
  /** How many readers have this on their wishlist. */
  wishers: number;
  catalogId: string | null;
  price: number | null;
}

/** The books readers have saved most; [] until the wishlist has any, or if the API is down. */
export async function getMostWished(): Promise<MostWishedBook[]> {
  try {
    const r = await fetch('/api/most-wished');
    if (!r.ok) return [];
    const { books } = (await r.json()) as { books?: MostWishedBook[] };
    return books ?? [];
  } catch {
    return [];
  }
}
