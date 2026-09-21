import { useState } from 'react';
import { toast } from 'sonner';

// Shared newsletter signup used by the footer, Home, and Shop sidebar forms.
// /api/newsletter-subscribe records the signup in Supabase and adds it to the
// Resend list the weekly newsletter goes to. Where the API isn't running
// (vite dev), fall back to the Supabase insert alone: duplicate emails surface
// as a unique violation (23505) - the table is insert-only under RLS.
async function signUp(email: string, source: string): Promise<'subscribed' | 'already-subscribed'> {
  try {
    const response = await fetch('/api/newsletter-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source }),
    });
    if (response.ok) return (await response.json()).status;
    if (response.status === 400) throw new Error('invalid');
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid') throw error;
  }

  const { supabase } = await import('@/lib/supabase');
  const { error } = await supabase.from('newsletter_subscribers').insert({
    email,
    source,
    subscribed_at: new Date().toISOString(),
    is_active: true,
  });
  if (error?.code === '23505') return 'already-subscribed';
  if (error) throw error;
  return 'subscribed';
}

export function useNewsletterSignup(source: string) {
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);

  const subscribe = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) return;

    setIsSubscribing(true);
    try {
      const status = await signUp(email.trim(), source);
      if (status === 'already-subscribed') {
        toast.info("You're already subscribed!");
      } else {
        toast.success('Welcome to our newsletter!');
        setEmail('');
      }
    } catch {
      toast.error('Failed to subscribe. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  return { email, setEmail, isSubscribing, subscribe };
}
