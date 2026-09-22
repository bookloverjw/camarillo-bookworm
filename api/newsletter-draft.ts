/**
 * Weekly newsletter draft - Vercel Serverless Function
 *
 * GET /api/newsletter-draft?preview=1
 *   -> the newsletter as HTML, to look at in a browser. Creates nothing.
 *
 * GET /api/newsletter-draft            (Vercel Cron, Tuesdays - see vercel.json)
 *   -> builds the newsletter and saves it in Resend as a DRAFT broadcast.
 *      Nothing is sent: open Resend > Broadcasts, read it over, edit if you
 *      like, and press Send. Requires "Authorization: Bearer $CRON_SECRET",
 *      which Vercel Cron sends on its own.
 *
 * SETUP REQUIRED (Vercel > Settings > Environment Variables):
 *   RESEND_API_KEY      from resend.com/api-keys
 *   RESEND_SEGMENT_ID   the segment (audience) subscribers are added to
 *   NEWSLETTER_FROM     e.g. Camarillo Bookworm <hello@updates.camarillobookworm.com>
 *                       - must be on the domain verified in Resend, which is
 *                       the updates. subdomain
 *   NEWSLETTER_REPLY_TO optional; where replies go. The sending subdomain has
 *                       no mailbox, so this defaults to the store's address.
 *   CRON_SECRET         any long random string
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildNewsletter } from './_lib/newsletter.js';

const SITE_URL = 'https://www.camarillobookworm.com';
const DEFAULT_REPLY_TO = 'sales@camarillobookworm.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  const newsletter = await buildNewsletter(SITE_URL);

  if (req.query.preview !== undefined) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(newsletter?.html ?? '<p>Nothing to send this week: no upcoming events or new books were found.</p>');
  }

  const { RESEND_API_KEY, RESEND_SEGMENT_ID, NEWSLETTER_FROM, CRON_SECRET } = process.env;
  if (!CRON_SECRET || req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!RESEND_API_KEY || !RESEND_SEGMENT_ID || !NEWSLETTER_FROM) {
    return res.status(503).json({ error: 'RESEND_API_KEY, RESEND_SEGMENT_ID and NEWSLETTER_FROM must be set' });
  }
  if (!newsletter) return res.status(200).json({ status: 'skipped', reason: 'nothing to send this week' });

  const response = await fetch('https://api.resend.com/broadcasts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    // No "send": this only ever creates a draft.
    body: JSON.stringify({
      segment_id: RESEND_SEGMENT_ID,
      from: NEWSLETTER_FROM,
      reply_to: process.env.NEWSLETTER_REPLY_TO || DEFAULT_REPLY_TO,
      subject: newsletter.subject,
      name: newsletter.name,
      html: newsletter.html,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    console.error('newsletter-draft: Resend refused the broadcast:', result);
    return res.status(502).json({ error: 'Resend could not create the draft', detail: result });
  }
  return res.status(200).json({ status: 'draft-created', id: result.id, subject: newsletter.subject });
}
