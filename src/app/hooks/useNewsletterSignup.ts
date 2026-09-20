import { useState } from 'react';
import { toast } from 'sonner';

// Shared newsletter signup used by the footer, Home, and Shop sidebar forms.
// Duplicate emails surface as a unique violation (23505) and get a friendly
// "already subscribed" message - the table is insert-only under RLS.
export function useNewsletterSignup(source: string) {
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);

  const subscribe = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) return;

    setIsSubscribing(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase.from('newsletter_subscribers').insert({
        email: email.trim(),
        source,
        subscribed_at: new Date().toISOString(),
        is_active: true,
      });

      if (error) {
        if (error.code === '23505') {
          toast.info("You're already subscribed!");
        } else {
          throw error;
        }
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
