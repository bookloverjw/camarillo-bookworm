/**
 * Homepage Bestsellers and New Releases - Vercel Serverless Function
 *
 * GET /api/homepage-books
 *
 * SETUP REQUIRED:
 *   Set NYT_API_KEY in Vercel (Settings > Environment Variables). Get a key
 *   at developer.nytimes.com with the Books API enabled. Without it this
 *   returns 503 and the homepage falls back to our own sales ranking.
 *
 * The NYT lists change once a week, so the response is cached at Vercel's
 * edge: fresh for 6 hours, then served stale for up to a day while a single
 * request refreshes it in the background. Visitors never wait on the NYT, and
 * the API's 500-calls-a-day allowance is never close to being reached.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildHomepageBooks } from './_lib/homepageBooks';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.NYT_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'NYT_API_KEY is not configured' });
  }

  try {
    const books = await buildHomepageBooks(apiKey);
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json(books);
  } catch (error) {
    console.error('homepage-books failed:', error);
    // Don't cache a failure; the next request should try again.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'Could not load the bestseller lists' });
  }
}
