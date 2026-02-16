import type { Event } from '@/app/utils/data';

const API_KEY = 'AlzaSyDA5ZN50FWfA_w3JgT6X_R3ANHL41QBTFA';

const CALENDAR_ID = 'c_da642ff06a28dO2114cd3f4bfc0074acf15d77618e13396e088db41fd847228c@group.calendar.google.com';

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
}

function parseEventType(summary: string, description?: string): Event['type'] {
  const text = `${summary} ${description || ''}`.toLowerCase();
  if (text.includes('story time') || text.includes('storytime')) return 'Kids Story Time';
  if (text.includes('book club')) return 'Book Club';
  if (text.includes('workshop')) return 'Workshop';
  if (text.includes('signing')) return 'Signing';
  return 'Author Reading';
}

function parseLocation(location?: string): Event['location'] {
  if (!location) return 'In-store';
  const loc = location.toLowerCase();
  if (loc.includes('virtual') || loc.includes('zoom') || loc.includes('online')) return 'Virtual';
  return 'In-store';
}

function formatTime(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function toLocalEvent(gcalEvent: GoogleCalendarEvent): Event {
  const startStr = gcalEvent.start.dateTime || gcalEvent.start.date || '';
  const startDate = new Date(startStr);

  return {
    id: gcalEvent.id,
    title: gcalEvent.summary,
    date: startDate.toISOString().split('T')[0],
    time: gcalEvent.start.dateTime ? formatTime(gcalEvent.start.dateTime) : 'All Day',
    type: parseEventType(gcalEvent.summary, gcalEvent.description),
    location: parseLocation(gcalEvent.location),
    description: gcalEvent.description || '',
  };
}

export async function fetchGoogleCalendarEvents(
  timeMin: string,
  timeMax: string
): Promise<Event[]> {
  const params = new URLSearchParams({
    key: API_KEY,
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Calendar API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.items || []).map(toLocalEvent);
}
