/**
 * The weekly newsletter, built from what the site already knows: upcoming
 * events (the store's Google Calendar), this week's new releases, books coming
 * soon, and whatever seasonal collection is running.
 *
 * Reads the site's own public endpoints, so the email always matches the
 * website. A section with nothing to say is left out; with no events and no
 * books at all there is no newsletter (build returns null).
 */

const STORE = {
  name: 'The Bookworm',
  address: '93 E Daily Dr, Camarillo, CA 93010',
  phone: '(805) 482-1384',
  hours: 'Mon–Fri 10–6 · Sat 10–5 · Sun 12–5',
};
const TIMEZONE = 'America/Los_Angeles';
const GREEN = '#1B4332';

interface CalendarEvent { id: string; title: string; start: string; allDay: boolean; description: string; private?: boolean }
interface ReleaseBook { isbn: string; title: string; author: string; cover: string | null; catalogId: string | null; releaseDate: string; description?: string; rank?: number }
interface UpcomingBook { isbn: string; title: string; author: string; publication_date: string; cover_url: string | null; catalog_id: string | null }

export interface Newsletter { subject: string; name: string; html: string }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

const bookshop = (isbn: string) => `https://bookshop.org/a/camarillobookworm/${isbn}`;

function bookLink(origin: string, isbn: string, catalogId: string | null) {
  return catalogId ? `${origin}/book/${encodeURIComponent(catalogId)}` : `${origin}/shop?search=${encodeURIComponent(isbn)}`;
}

function eventWhen(e: CalendarEvent) {
  const start = new Date(e.allDay ? `${e.start}T12:00:00` : e.start);
  const day = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: e.allDay ? 'UTC' : TIMEZONE });
  if (e.allDay) return day;
  return `${day} · ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TIMEZONE })}`;
}

function section(title: string, body: string) {
  return `<tr><td style="padding:28px 32px 0">
    <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-size:22px;color:${GREEN}">${esc(title)}</h2>
    ${body}
  </td></tr>`;
}

function bookRow(link: string, cover: string | null, title: string, author: string, note: string) {
  const image = cover
    ? `<td width="72" valign="top" style="padding:0 14px 16px 0"><a href="${link}"><img src="${esc(cover)}" width="72" alt="" style="display:block;border-radius:4px"></a></td>`
    : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>${image}
    <td valign="top" style="padding-bottom:16px;font-family:Helvetica,Arial,sans-serif">
      <a href="${link}" style="font-family:Georgia,serif;font-size:17px;font-weight:bold;color:#1a1a1a;text-decoration:none">${esc(title)}</a>
      <div style="font-size:14px;color:#555;margin-top:2px">${esc(author)}</div>
      ${note ? `<div style="font-size:14px;color:#333;margin-top:6px;line-height:1.45">${esc(note)}</div>` : ''}
    </td></tr></table>`;
}

export async function buildNewsletter(origin: string, now = new Date()): Promise<Newsletter | null> {
  const [calendar, homepage, comingSoon] = await Promise.all([
    getJson<{ events: CalendarEvent[] }>(`${origin}/api/calendar-events`),
    getJson<{ newReleases: ReleaseBook[] }>(`${origin}/api/homepage-books`),
    getJson<{ books: UpcomingBook[] }>(`${origin}/coming-soon.json`),
  ]);

  const today = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const horizon = new Date(now.getTime() + 21 * 86_400_000).toISOString();

  // Public events in the next three weeks
  const events = (calendar?.events ?? [])
    .filter((e) => !e.private && e.start >= today && e.start <= horizon)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 6);

  // Released in the last two weeks, best-ranked first, one per title
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
  const seen = new Set<string>();
  const releases = (homepage?.newReleases ?? [])
    .filter((b) => b.releaseDate >= twoWeeksAgo && b.releaseDate <= today)
    .filter((b) => !seen.has(b.title) && seen.add(b.title))
    .slice(0, 5);

  const upcoming = (comingSoon?.books ?? [])
    .filter((b) => b.publication_date > today)
    .sort((a, b) => a.publication_date.localeCompare(b.publication_date))
    .slice(0, 4);

  if (events.length === 0 && releases.length === 0 && upcoming.length === 0) return null;

  // Whatever seasonal collection the homepage is featuring
  let seasonal: { title: string; blurb: string; to: string; cta: string } | null = null;
  try {
    const { activeFeatures } = await import('../../src/lib/seasons.js');
    seasonal = activeFeatures(now)[0] ?? null;
  } catch {
    // The newsletter is fine without it
  }

  const parts: string[] = [];

  if (events.length > 0) {
    parts.push(section('Coming up at the store', events.map((e) => `
      <div style="padding:0 0 14px;font-family:Helvetica,Arial,sans-serif">
        <div style="font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:${GREEN};font-weight:bold">${esc(eventWhen(e))}</div>
        <div style="font-family:Georgia,serif;font-size:17px;font-weight:bold;color:#1a1a1a;margin-top:2px">${esc(e.title)}</div>
        ${e.description ? `<div style="font-size:14px;color:#333;margin-top:4px;line-height:1.45">${esc(e.description.slice(0, 220))}${e.description.length > 220 ? '…' : ''}</div>` : ''}
      </div>`).join('') + `<a href="${origin}/events" style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:${GREEN};font-weight:bold">See the full calendar &amp; RSVP →</a>`));
  }

  if (releases.length > 0) {
    parts.push(section('New this week', releases.map((b) =>
      bookRow(bookLink(origin, b.isbn, b.catalogId), b.cover, b.title, b.author, b.description ?? '')).join('')));
  }

  if (seasonal) {
    parts.push(section(seasonal.title, `
      <p style="margin:0 0 12px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#333">${esc(seasonal.blurb)}</p>
      <a href="${origin}${seasonal.to}" style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:${GREEN};font-weight:bold">${esc(seasonal.cta)} →</a>`));
  }

  if (upcoming.length > 0) {
    parts.push(section('Coming soon - reserve yours', upcoming.map((b) => {
      const date = new Date(`${b.publication_date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
      return bookRow(b.catalog_id ? bookLink(origin, b.isbn, b.catalog_id) : bookshop(b.isbn), b.cover_url, b.title, b.author, `Out ${date}`);
    }).join('') + `<p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#333">Call us at ${STORE.phone} or stop by and we'll hold a copy for you.</p>`));
  }

  const dateLabel = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: TIMEZONE });
  const lead = events[0]?.title ?? releases[0]?.title ?? upcoming[0].title;
  const subject = events.length > 0
    ? `This week at the Bookworm: ${lead}${releases[0] ? ' + new releases' : ''}`
    : `New at the Bookworm: ${lead} and more`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f1ea">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">
  <tr><td style="background:${GREEN};padding:24px 32px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle">
        <a href="${origin}" style="font-family:Georgia,serif;font-size:28px;font-weight:bold;color:#ffffff;text-decoration:none"><i style="font-weight:normal">The</i> Bookworm</a>
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#B7E4C7;margin-top:4px">Camarillo's independent bookstore since 1973 · ${esc(dateLabel)}</div>
      </td>
      <td valign="middle" align="right" width="120"><a href="${origin}"><img src="${origin}/brand/glasses-badge.png" width="112" height="63" alt="" style="display:block;border:0"></a></td>
    </tr></table>
  </td></tr>
  ${parts.join('\n')}
  <tr><td style="padding:32px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#777">
    <hr style="border:none;border-top:1px solid #e5e0d5;margin:0 0 18px">
    ${STORE.name} · ${STORE.address} · ${STORE.phone}<br>${STORE.hours}<br>
    You're getting this because you signed up at camarillobookworm.com or in the store.
    <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#777">Unsubscribe</a>
  </td></tr>
</table></td></tr></table></body></html>`;

  return { subject, name: `Weekly newsletter - ${today}`, html };
}
