/**
 * Most wished for - Vercel Serverless Function
 *
 * GET /api/most-wished -> { books: [{ isbn, title, author, cover, wishers, catalogId, price }] }
 *
 * The books readers have saved to their wishlists most, from the
 * most_wished() function (supabase/most-wished.sql), which returns counts
 * only - never who saved what. Books we carry get their catalogue id, so
 * the page can open our own quick view. Cached at the edge for an hour.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = 'https://lildbdxabljkoynvpflu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_h_B4nBpI9hTOycnv4Fj6Tw_epMD62aO';
const HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' };

interface Row { isbn: string; title: string; author: string; cover_url: string | null; wishers: number }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/most_wished`, {
      method: 'POST', headers: HEADERS, body: JSON.stringify({ max_rows: 24 }),
    });
    if (!r.ok) throw new Error(`most_wished returned ${r.status}: ${await r.text()}`);
    const rows = (await r.json()) as Row[];

    // Which of these do we carry?
    const ours = new Map<string, { id: string; price: number | null; cover_url: string | null }>();
    if (rows.length) {
      const q = await fetch(
        `${SUPABASE_URL}/rest/v1/books?select=id,isbn,price,list_price,cover_url&isbn=in.(${rows.map(b => b.isbn).join(',')})`,
        { headers: HEADERS },
      );
      if (q.ok) for (const b of (await q.json()) as any[]) ours.set(b.isbn, { id: b.id, price: Number(b.list_price || b.price) || null, cover_url: b.cover_url });
    }

    const books = rows.map(b => ({
      isbn: b.isbn, title: b.title, author: b.author,
      cover: b.cover_url || ours.get(b.isbn)?.cover_url || null,
      wishers: Number(b.wishers),
      catalogId: ours.get(b.isbn)?.id ?? null,
      price: ours.get(b.isbn)?.price ?? null,
    }));
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ books });
  } catch (error) {
    console.error('most-wished failed:', error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Could not load the most wished for books' });
  }
}
