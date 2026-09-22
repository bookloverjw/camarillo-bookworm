import { supabase } from '@/lib/supabase';

/**
 * What a signed-in customer wants to hear about, and the authors they
 * follow. Tables from supabase/notification-preferences.sql; the newsletter
 * switch also goes to Resend through /api/newsletter-preference.
 *
 * Only the newsletter is sent today. The other switches and the follows are
 * recorded so those emails can start the moment there's something to send.
 */
export interface NotificationPreferences {
  newsletter: boolean;
  events: boolean;
  book_clubs: boolean;
  author_alerts: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = { newsletter: false, events: true, book_clubs: true, author_alerts: true };

export async function getPreferences(customerId: string): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('newsletter,events,book_clubs,author_alerts')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function savePreferences(customerId: string, prefs: NotificationPreferences): Promise<void> {
  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ customer_id: customerId, ...prefs, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Turn the weekly newsletter on or off for the signed-in customer's own email. */
export async function setNewsletter(subscribed: boolean): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in first');
  const r = await fetch('/api/newsletter-preference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ subscribed }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || `newsletter-preference ${r.status}`);
}

export interface AuthorFollow { id: string; author: string }

export async function listFollows(customerId: string): Promise<AuthorFollow[]> {
  const { data, error } = await supabase
    .from('author_follows').select('id,author').eq('customer_id', customerId).order('author');
  if (error) throw error;
  return data ?? [];
}

/** "  sarah j. maas " -> "Sarah J. Maas" is the author's business; we just trim and collapse spaces. */
const clean = (author: string) => author.replace(/\s+/g, ' ').trim();

export async function followAuthor(customerId: string, author: string): Promise<AuthorFollow | null> {
  const name = clean(author);
  if (!name) return null;
  const { data, error } = await supabase
    .from('author_follows').insert({ customer_id: customerId, author: name }).select('id,author').single();
  if (error && error.code !== '23505') throw error;
  return data ?? null;
}

export async function unfollowAuthor(id: string): Promise<void> {
  const { error } = await supabase.from('author_follows').delete().eq('id', id);
  if (error) throw error;
}
