import React from 'react';
import { useSearchParams, Link } from 'react-router';
import { CalendarDays, BookOpen, Sparkles, CheckCircle, Loader2 } from 'lucide-react';
import { useNewsletterSignup } from '@/app/hooks/useNewsletterSignup';

// Where the counter sign's QR code and event sign-up sheets point. ?src=
// records where the signup came from (store, event...) alongside the email.
const WHAT_YOU_GET = [
  { icon: CalendarDays, title: 'Events first', text: 'Author visits, signings, book clubs and story times - before the seats fill up.' },
  { icon: BookOpen, title: "The week's new books", text: "What just came out and what's worth your time." },
  { icon: Sparkles, title: 'Coming soon', text: 'Big releases on the way, so we can hold a copy for you.' },
];

export const Newsletter = () => {
  const [params] = useSearchParams();
  const source = (params.get('src') ?? '').replace(/[^a-z0-9-]/gi, '').slice(0, 24).toLowerCase();
  const { email, setEmail, isSubscribing, isSubscribed, subscribe } = useNewsletterSignup(source ? `page-${source}` : 'newsletter-page');

  return (
    <div className="bg-background">
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
        <img src="/brand/mascot.png" alt="" width={900} height={940} className="w-40 sm:w-48 h-auto mx-auto mb-6" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4">The Bookworm newsletter</p>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold text-foreground mb-5">Be first to hear</h1>
        <p className="text-lg text-muted-foreground mb-10">
          One short email from your neighborhood bookstore: who's visiting, what's new on the shelves, and what's worth waiting for.
        </p>

        {isSubscribed ? (
          <div className="bg-muted rounded-2xl border border-border p-8" role="status">
            <CheckCircle className="mx-auto text-primary mb-3" size={40} />
            <h2 className="font-serif text-2xl font-bold text-foreground mb-2">You're on the list</h2>
            <p className="text-muted-foreground mb-5">Thank you! Look for us in your inbox.</p>
            <Link to="/events" className="text-primary font-medium underline">See what's coming up at the store</Link>
          </div>
        ) : (
          <form onSubmit={subscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              aria-label="Email address"
              className="flex-1 px-4 py-3.5 rounded border border-border bg-white text-base outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={isSubscribing}
              className="bg-primary text-white px-7 py-3.5 rounded text-base font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {isSubscribing && <Loader2 size={16} className="animate-spin" />}
              {isSubscribing ? 'Signing up…' : 'Sign me up'}
            </button>
          </form>
        )}
        <p className="text-xs text-muted-foreground mt-4">No spam, ever. Unsubscribe with one click.</p>
      </section>

      <section className="bg-muted/50 py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 grid gap-8 sm:grid-cols-3">
          {WHAT_YOU_GET.map(({ icon: Icon, title, text }) => (
            <div key={title} className="text-center">
              <Icon className="mx-auto text-primary mb-3" size={28} />
              <h3 className="font-serif text-xl font-bold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
