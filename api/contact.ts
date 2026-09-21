/**
 * Contact form -> email to the store.
 *
 *   POST /api/contact  { name, email, phone?, subject, message, website? }
 *
 * Sends the message to CONTACT_TO (default Sales@camarillobookworm.com)
 * through Resend, with the visitor as Reply-To so staff can answer straight
 * from their inbox. Needs RESEND_API_KEY; CONTACT_FROM must be an address on
 * a domain verified in Resend.
 */

const TO = process.env.CONTACT_TO || 'Sales@camarillobookworm.com';
// The domain verified in Resend is the updates. subdomain.
const FROM = process.env.CONTACT_FROM || 'The Bookworm Website <website@updates.camarillobookworm.com>';

const SUBJECTS = new Set([
  'General Inquiry', 'Order Status', 'Special Order Request', 'Event Question',
  'Book Recommendation', 'Gift Cards', 'Media/Press', 'Other',
]);

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ');
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  // Honeypot: a hidden field people never fill in. Pretend it worked.
  if (text(body.website, 200)) return res.status(200).json({ ok: true });

  const name = oneLine(text(body.name, 120));
  const email = oneLine(text(body.email, 200));
  const phone = oneLine(text(body.phone, 40));
  const topic = SUBJECTS.has(body.subject) ? body.subject : 'General Inquiry';
  const message = text(body.message, 5000);

  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please include your name, a valid email and a message.' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('contact: RESEND_API_KEY is not set');
    return res.status(503).json({ error: 'Email is not configured.' });
  }

  const rows: [string, string][] = [['Name', name], ['Email', email], ['Phone', phone || '—'], ['Topic', topic]];
  const plain = `New message from the camarillobookworm.com contact form.\n\n${rows
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}\n\n${message}\n\n(Reply to this email to answer ${name} directly.)`;
  const html = `<p>New message from the <strong>camarillobookworm.com</strong> contact form.</p>
<table cellpadding="4">${rows
    .map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${escapeHtml(v)}</td></tr>`)
    .join('')}</table>
<p style="white-space:pre-wrap">${escapeHtml(message)}</p>
<p style="color:#666">Reply to this email to answer ${escapeHtml(name)} directly.</p>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: `Website contact form: ${topic} from ${name}`,
        text: plain,
        html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
      console.error('contact: Resend returned', r.status, await r.text());
      return res.status(502).json({ error: 'Could not send the message.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('contact: send failed', err);
    return res.status(502).json({ error: 'Could not send the message.' });
  }
}
