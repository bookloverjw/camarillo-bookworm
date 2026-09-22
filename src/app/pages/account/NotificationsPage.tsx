import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Mail, CalendarDays, Users, BookOpen, Loader2, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import {
  DEFAULT_PREFERENCES, getPreferences, savePreferences, setNewsletter,
  listFollows, followAuthor, unfollowAuthor, type NotificationPreferences, type AuthorFollow,
} from '@/lib/notifications';

const SWITCHES: { key: keyof NotificationPreferences; icon: React.ElementType; title: string; text: string; live?: boolean }[] = [
  { key: 'newsletter', icon: Mail, title: 'The weekly newsletter', text: "Author events, book clubs and the week's new books - one short email, most Tuesdays.", live: true },
  { key: 'events', icon: CalendarDays, title: 'Author signings & readings', text: 'A note when an author is coming to the store, before the seats fill up.' },
  { key: 'book_clubs', icon: Users, title: 'Book clubs', text: 'New clubs starting up, and what the clubs are reading next.' },
  { key: 'author_alerts', icon: BookOpen, title: 'New books by authors you follow', text: 'When an author on your list has a new book on the way, so we can hold you a copy.' },
];

const Switch = ({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) => (
  <button
    type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
    onClick={() => onChange(!on)}
    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${on ? 'bg-primary' : 'bg-border'}`}
  >
    <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
);

export const NotificationsPage = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [follows, setFollows] = useState<AuthorFollow[]>([]);
  const [newAuthor, setNewAuthor] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([getPreferences(user.id), listFollows(user.id)])
      .then(([p, f]) => { setPrefs(p ?? DEFAULT_PREFERENCES); setFollows(f); })
      .catch((err) => {
        // The tables aren't there until the migration has run
        console.warn('Notification preferences unavailable:', err?.message);
        setPrefs(DEFAULT_PREFERENCES);
        setUnavailable(true);
      });
  }, [user]);

  const change = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user || !prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setBusy(key);
    try {
      if (key === 'newsletter') await setNewsletter(value);
      await savePreferences(user.id, next);
      toast.success(key === 'newsletter'
        ? (value ? "You're on the newsletter list." : 'Unsubscribed from the newsletter.')
        : 'Saved.');
    } catch (err) {
      setPrefs(prefs);
      toast.error("Couldn't save that. Please try again.", { description: (err as Error)?.message });
    } finally {
      setBusy(null);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newAuthor.trim()) return;
    setBusy('follow');
    try {
      const added = await followAuthor(user.id, newAuthor);
      if (added) setFollows(f => [...f, added].sort((a, b) => a.author.localeCompare(b.author)));
      else toast.info('Already following them.');
      setNewAuthor('');
    } catch (err) {
      toast.error("Couldn't add that author.", { description: (err as Error)?.message });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (f: AuthorFollow) => {
    setFollows(list => list.filter(x => x.id !== f.id));
    try { await unfollowAuthor(f.id); } catch { setFollows(list => [...list, f]); toast.error("Couldn't remove that author."); }
  };

  if (!prefs) {
    return <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground"><Loader2 className="animate-spin text-primary" size={24} /> Loading…</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-serif font-bold text-primary mb-2">Notification Preferences</h2>
        <p className="text-muted-foreground">Choose what we email you about. We keep it to what's worth your inbox.</p>
      </div>

      {unavailable && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">Preferences can't be saved right now - please try again later.</p>
      )}

      <section className="bg-white rounded-2xl border border-border shadow-sm divide-y divide-border">
        {SWITCHES.map(({ key, icon: Icon, title, text, live }) => (
          <div key={key} className="flex items-start gap-4 p-6">
            <div className="p-3 bg-accent/10 rounded-xl text-accent shrink-0"><Icon size={20} /></div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-primary">{title}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
              {!live && <p className="text-[11px] text-muted-foreground/70 mt-1">Coming soon - we'll honour this the moment these emails start.</p>}
            </div>
            {busy === key ? <Loader2 size={20} className="animate-spin text-primary mt-1" /> : (
              <Switch on={prefs[key]} onChange={(v) => change(key, v)} disabled={unavailable} label={title} />
            )}
          </div>
        ))}
      </section>

      <section className="bg-white rounded-2xl border border-border shadow-sm p-6">
        <h3 className="font-bold text-primary mb-1">Authors you follow</h3>
        <p className="text-sm text-muted-foreground mb-5">
          We'll let you know when they have a new book coming. You can also follow an author from any book's page.
        </p>
        <form onSubmit={add} className="flex gap-2 mb-5">
          <input
            value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} placeholder="Add an author, e.g. Louise Erdrich"
            disabled={unavailable}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-white text-sm outline-none focus:border-primary disabled:opacity-50"
          />
          <button type="submit" disabled={unavailable || busy === 'follow' || !newAuthor.trim()}
                  className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
            {busy === 'follow' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Follow
          </button>
        </form>
        {follows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No authors yet. <Link to="/shop" className="text-primary underline">Find a favourite</Link> and tap "Follow" on their book.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {follows.map(f => (
              <li key={f.id} className="inline-flex items-center gap-2 bg-muted rounded-full pl-4 pr-2 py-1.5 text-sm text-primary">
                {f.author}
                <button onClick={() => remove(f)} aria-label={`Unfollow ${f.author}`} className="p-1 rounded-full hover:bg-white hover:text-red-500"><X size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
