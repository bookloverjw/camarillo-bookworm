/**
 * The store's events, straight from its Google Calendar - Vercel Serverless Function
 *
 * GET /api/calendar-events
 *   -> { events: [{ id, title, start, end, allDay, description, location }] }
 *
 * Reads the calendar's public iCal feed, which needs no API key: the calendar
 * is public, and the old API-key integration had a mistyped key and calendar
 * ID and never worked. Add or change an event in Google Calendar and the
 * site shows it within about fifteen minutes.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CALENDAR_ID = 'c_da642ff06a28d02114cd3f4bfc0074acf15d77618e13396e088db41fd847228c@group.calendar.google.com';
const FEED = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`;

interface CalendarEvent {
  id: string;
  title: string;
  /** ISO 8601, UTC. */
  start: string;
  end: string | null;
  allDay: boolean;
  description: string;
  location: string;
}

/** iCal text escapes: \, \; \n \\ */
const unescape = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();

/** Minutes a time zone is ahead of UTC at a given instant (negative west of UTC). */
function zoneOffsetMinutes(at: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at).map(p => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUtc - at.getTime()) / 60000;
}

/**
 * DTSTART / DTEND in any of the three forms Google writes:
 *   DTSTART:20260924T003000Z                        a UTC instant
 *   DTSTART;TZID=America/Los_Angeles:20261003T140000 a local time
 *   DTSTART;VALUE=DATE:20261003                     an all-day date
 */
function parseDate(params: string, value: string): { iso: string; allDay: boolean } | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h) return { iso: `${y}-${mo}-${d}`, allDay: true };
  const utcGuess = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  if (z) return { iso: utcGuess.toISOString(), allDay: false };
  const tz = params.match(/TZID=([^;:]+)/)?.[1] ?? 'America/Los_Angeles';
  const offset = zoneOffsetMinutes(utcGuess, tz);
  return { iso: new Date(utcGuess.getTime() - offset * 60000).toISOString(), allDay: false };
}

/**
 * Calendar titles carry the time and are often in capitals: "SCI-FI BOOKCLUB
 * 5:30PM", "AUTHOR SIGNING 12:00-3:00". The site shows the time on its own,
 * so drop it, and bring shouting titles back to title case.
 */
export function cleanTitle(raw: string) {
  let t = raw
    .replace(/\s*[-–—@,]?\s*\d{1,2}(:\d{2})?\s*(am|pm)?\s*([-–—]\s*\d{1,2}(:\d{2})?\s*(am|pm)?)?\s*$/i, '')
    .replace(/\bbook ?club\b/gi, 'Book Club')
    .trim();
  t = t.replace(/[A-Za-z]+(?:[-'’][A-Za-z]+)*/g, word =>
    word.length > 1 && word === word.toUpperCase()
      ? word.toLowerCase().replace(/(^|[-'’])([a-z])/g, (_, sep, c) => sep + c.toUpperCase())
      : word,
  );
  return t || raw.trim();
}

/**
 * Descriptions synced from the store's schedule arrive as
 * "From schedule Notes cell:\n***SCI-FI BOOKCLUB 5:30PM***". Drop the sync
 * boilerplate and the asterisks, and drop the note entirely when all it does
 * is repeat the title.
 */
export function cleanDescription(raw: string, title: string) {
  const d = raw
    .replace(/^\s*from schedule notes cell:?\s*/i, '')
    .replace(/\*{2,}/g, '')
    .trim();
  const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return !d || fold(cleanTitle(d)) === fold(title) ? '' : d;
}

export function parseFeed(ics: string): CalendarEvent[] {
  // Undo line folding: a line starting with a space or tab continues the last.
  const lines = ics.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const events: CalendarEvent[] = [];
  let cur: Record<string, { params: string; value: string }> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT' && cur) {
      const start = cur.DTSTART && parseDate(cur.DTSTART.params, cur.DTSTART.value);
      const end = cur.DTEND && parseDate(cur.DTEND.params, cur.DTEND.value);
      if (start && cur.STATUS?.value !== 'CANCELLED') {
        if (cur.RRULE) console.warn(`calendar-events: "${cur.SUMMARY?.value}" repeats; only its first date is shown`);
        const title = cleanTitle(unescape(cur.SUMMARY?.value || 'Event'));
        events.push({
          id: cur.UID?.value || `${start.iso}-${cur.SUMMARY?.value}`,
          title,
          start: start.iso,
          end: end ? end.iso : null,
          allDay: start.allDay,
          description: cleanDescription(unescape(cur.DESCRIPTION?.value || ''), title),
          location: unescape(cur.LOCATION?.value || ''),
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const m = line.match(/^([A-Z-]+)((?:;[^:]*)?):(.*)$/);
    if (m) cur[m[1]] = { params: m[2], value: m[3] };
  }
  return events.sort((a, b) => a.start.localeCompare(b.start));
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const feed = await fetch(FEED, { signal: AbortSignal.timeout(10000) });
    if (!feed.ok) throw new Error(`Google Calendar feed ${feed.status}`);
    const events = parseFeed(await feed.text());
    // Fresh for 15 minutes; a day-old copy is fine while it refreshes.
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400');
    return res.status(200).json({ events });
  } catch (error) {
    console.error('calendar-events failed:', error);
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(502).json({ error: 'Could not read the store calendar' });
  }
}
