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

function mapSupabaseEvent(sb: SupabaseEvent): Event {
  const start = new Date(sb.start_time);
  return {
    id: sb.id,
    title: sb.title,
    date: start.toISOString().split('T')[0],
    time: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    type: EVENT_TYPE_MAP[sb.event_type] || 'Author Reading',
    location: LOCATION_MAP[sb.location] || 'In-store',
    description: sb.description || '',
    author: sb.featured_book_author || undefined,
    featuredBookId: sb.featured_isbn || undefined,
  };
}

/**
 * Fetch upcoming published events from Supabase
 */
export async function getUpcomingEvents(limit: number = 10): Promise<Event[]> {
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
 * Fetch events for a specific month from Supabase
 */
export async function getEventsByMonth(year: number, month: number): Promise<Event[]> {
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
