/**
 * Newsletter signup - Vercel Serverless Function
 *
 * POST /api/newsletter-subscribe  { email, source }
 *   -> { status: 'subscribed' | 'already-subscribed' }
 *
 * Records the signup in Supabase (newsletter_subscribers, as before) and adds
 * the address to the Resend segment the weekly newsletter goes to. Supabase is
 * the record of who signed up and where; Resend owns sending and unsubscribes.
 * Until RESEND_API_KEY / RESEND_SEGMENT_ID are set, only Supabase is written.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = 'https://lildbdxabljkoynvpflu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_h_B4nBpI9hTOycnv4Fj6Tw_epMD62aO';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const source = String(req.body?.source ?? 'website').slice(0, 40);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const insert = await fetch(`${SUPABASE_URL}/rest/v1/newsletter_subscribers`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ email, source, subscribed_at: new Date().toISOString(), is_active: true }),
  });
  // 409 = unique violation: they signed up before
  const already = insert.status === 409;
  if (!insert.ok && !already) {
    console.error('newsletter-subscribe: Supabase insert failed:', insert.status, await insert.text());
    return res.status(502).json({ error: 'Could not save the signup' });
  }

  const { RESEND_API_KEY, RESEND_SEGMENT_ID } = process.env;
  if (RESEND_API_KEY && RESEND_SEGMENT_ID) {
    try {
      const contact = await fetch('https://api.resend.com/contacts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, segments: [{ id: RESEND_SEGMENT_ID }] }),
      });
      // A contact that already exists is fine; anything else is worth a log
      // line, but the signup itself is safely recorded in Supabase.
      if (!contact.ok && contact.status !== 409) {
        console.error('newsletter-subscribe: Resend contact failed:', contact.status, await contact.text());
      }
    } catch (error) {
      console.error('newsletter-subscribe: Resend unreachable:', error);
    }
  }

  return res.status(200).json({ status: already ? 'already-subscribed' : 'subscribed' });
}
