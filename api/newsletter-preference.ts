/**
 * Newsletter on/off for a signed-in customer - Vercel Serverless Function
 *
 * POST /api/newsletter-preference  { subscribed: boolean }
 *   Authorization: Bearer <the customer's Supabase access token>
 *
 * The token is checked with Supabase, so the email that gets subscribed or
 * unsubscribed in Resend is the caller's own and nobody else's. Subscribing
 * (re)creates the Resend contact in the newsletter segment and records the
 * signup as the forms do; unsubscribing marks the contact unsubscribed.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = 'https://lildbdxabljkoynvpflu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_h_B4nBpI9hTOycnv4Fj6Tw_epMD62aO';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in first' });
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!who.ok) return res.status(401).json({ error: 'Sign in first' });
  const email = String(((await who.json()) as { email?: string }).email || '').toLowerCase();
  if (!email) return res.status(400).json({ error: 'No email on this account' });

  const subscribed = req.body?.subscribed === true;
  const { RESEND_API_KEY, RESEND_SEGMENT_ID } = process.env;
  if (!RESEND_API_KEY || !RESEND_SEGMENT_ID) return res.status(503).json({ error: 'Newsletter is not configured' });
  const headers = { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' };

  try {
    if (subscribed) {
      const create = await fetch('https://api.resend.com/contacts', {
        method: 'POST', headers, body: JSON.stringify({ email, unsubscribed: false, segments: [{ id: RESEND_SEGMENT_ID }] }),
      });
      // Already a contact (maybe unsubscribed earlier): flip them back on
      if (create.status === 409 || !create.ok) {
        const update = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}`, {
          method: 'PATCH', headers, body: JSON.stringify({ unsubscribed: false }),
        });
        if (!update.ok) throw new Error(`Resend ${update.status}: ${await update.text()}`);
      }
      // Record the signup like the forms do (insert-only table; duplicates are fine)
      fetch(`${SUPABASE_URL}/rest/v1/newsletter_subscribers`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ email, source: 'account-preferences', subscribed_at: new Date().toISOString(), is_active: true }),
      }).catch(() => {});
    } else {
      const update = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}`, {
        method: 'PATCH', headers, body: JSON.stringify({ unsubscribed: true }),
      });
      // Never a contact: nothing to unsubscribe
      if (!update.ok && update.status !== 404) throw new Error(`Resend ${update.status}: ${await update.text()}`);
    }
    return res.status(200).json({ subscribed });
  } catch (error) {
    console.error('newsletter-preference failed:', error);
    return res.status(502).json({ error: 'Could not update the newsletter subscription' });
  }
}
