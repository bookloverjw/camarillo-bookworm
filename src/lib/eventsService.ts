/**
 * Events Service
 * Fetches events from Supabase events table
 */

import { supabase } from './supabase';
import type { Event } from '@/app/utils/data';

interface SupabaseEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  location: string;
  start_time: string;
  end_time: string | null;
  max_attendees: number | null;
  registration_required: boolean;
  registration_fee: number | null;
  featured_isbn: string | null;
  featured_book_title: string | null;
  featured_book_author: string | null;
  featured_book_cover: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

const EVENT_TYPE_MAP: Record<string, Event['type']> = {
  author_reading: 'Author Reading',
  book_club: 'Book Club',
  kids_story_time: 'Kids Story Time',
  workshop: 'Workshop',
  signing: 'Signing',
};

const LOCATION_MAP: Record<string, Event['location']> = {
  in_store: 'In-store',
  virtual: 'Virtual',
  offsite: 'In-store',
};

// All event times are formatted in the store's timezone, for every visitor.
// (toISOString() is always UTC, so a 7pm Pacific event would have shown the
// next day's date; viewer-local formatting would shift it for travelers.)
const STORE_TIMEZONE = 'America/Los_Angeles';

function mapSupabaseEvent(sb: SupabaseEvent): Event {
  const start = new Date(sb.start_time);
  return {
    id: sb.id,
    title: sb.title,
    // en-CA locale formats as YYYY-MM-DD
    date: start.toLocaleDateString('en-CA', { timeZone: STORE_TIMEZONE }),
    time: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: STORE_TIMEZONE }),
    type: EVENT_TYPE_MAP[sb.event_type] || 'Author Reading',
    location: LOCATION_MAP[sb.location] || 'In-store',
    description: sb.description || '',
    author: sb.featured_book_author || undefined,
    featuredBookId: sb.featured_isbn || undefined,
  };
}

// ---------------------------------------------------------------------------
// The store's Google Calendar is the source of truth for events. It's read
// through /api/calendar-events (the calendar's public iCal feed); the
// Supabase events table is only a fallback, and is currently empty.
// ---------------------------------------------------------------------------

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  description: string;
  location: string;
}

function eventType(title: string, description = ''): Event['type'] {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('story time') || text.includes('storytime')) return 'Kids Story Time';
  if (text.includes('book club') || text.includes('bookclub')) return 'Book Club';
  if (text.includes('workshop')) return 'Workshop';
  if (text.includes('signing')) return 'Signing';
  return 'Author Reading';
}

function eventLocation(location: string): Event['location'] {
  return /virtual|zoom|online/i.test(location) ? 'Virtual' : 'In-store';
}

const clock = (d: Date) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: STORE_TIMEZONE });

/** "5:30 – 7:00 PM", "10:30 AM – 12:00 PM", or "All day". */
function timeRange(e: CalendarEvent) {
  if (e.allDay) return 'All day';
  const start = clock(new Date(e.start));
  if (!e.end) return start;
  const end = clock(new Date(e.end));
  const [s, sm] = start.split(' ');
  const [, em] = end.split(' ');
  return sm === em ? `${s} – ${end}` : `${start} – ${end}`;
}

function mapCalendarEvent(e: CalendarEvent): Event {
  const start = new Date(e.allDay ? `${e.start}T12:00:00` : e.start);
  return {
    id: e.id,
    title: e.title,
    date: e.allDay ? e.start : start.toLocaleDateString('en-CA', { timeZone: STORE_TIMEZONE }),
    time: timeRange(e),
    type: eventType(e.title, e.description),
    location: eventLocation(e.location),
    description: e.description,
  };
}

let calendarRequest: Promise<Event[] | null> | null = null;

/** The calendar's events, fetched once per page load; null if it can't be read. */
function calendarEvents(): Promise<Event[] | null> {
  calendarRequest ??= fetch('/api/calendar-events')
    .then(r => (r.ok ? r.json() : null))
    .then(body => (body?.events ? (body.events as CalendarEvent[]).map(mapCalendarEvent) : null))
    .catch(() => null);
  return calendarRequest;
}

const todayInStore = () => new Date().toLocaleDateString('en-CA', { timeZone: STORE_TIMEZONE });

/**
 * Upcoming events, soonest first.
 */
export async function getUpcomingEvents(limit: number = 10): Promise<Event[]> {
  const fromCalendar = await calendarEvents();
  if (fromCalendar) {
    const today = todayInStore();
    return fromCalendar.filter(e => e.date >= today).slice(0, limit);
  }

  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_published', true)
      .gte('start_time', now)
      .order('start_time', { ascending: true })
      .limit(limit);

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map(mapSupabaseEvent);
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}

/**
 * Events in one month (month is 0-based), in the store's time zone.
 */
export async function getEventsByMonth(year: number, month: number): Promise<Event[]> {
  const fromCalendar = await calendarEvents();
  if (fromCalendar) {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return fromCalendar.filter(e => e.date.startsWith(prefix));
  }

  try {
    const timeMin = new Date(year, month, 1).toISOString();
    const timeMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_published', true)
      .gte('start_time', timeMin)
      .lte('start_time', timeMax)
      .order('start_time', { ascending: true });

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map(mapSupabaseEvent);
  } catch (error) {
    console.error('Error fetching events by month:', error);
    return [];
  }
}
