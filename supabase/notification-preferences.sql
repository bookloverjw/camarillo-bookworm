-- ============================================================
-- The Bookworm - notification preferences and followed authors
-- ============================================================
-- What each signed-in customer wants to hear about (Account > Notification
-- Preferences), and the authors they follow. Owner-only under RLS, like
-- wishlists. Run in the Supabase SQL editor; safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  customer_id   uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  newsletter    boolean NOT NULL DEFAULT false,  -- the weekly email (mirrored to Resend)
  events        boolean NOT NULL DEFAULT true,   -- author signings and readings
  book_clubs    boolean NOT NULL DEFAULT true,   -- new clubs and club news
  author_alerts boolean NOT NULL DEFAULT true,   -- new books by followed authors
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.author_follows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  author      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, author)
);
CREATE INDEX IF NOT EXISTS idx_author_follows_author ON public.author_follows (lower(author));

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own preferences" ON public.notification_preferences;
CREATE POLICY "own preferences" ON public.notification_preferences FOR ALL
  USING (customer_id = (SELECT auth.uid()))
  WITH CHECK (customer_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "own follows" ON public.author_follows;
CREATE POLICY "own follows" ON public.author_follows FOR ALL
  USING (customer_id = (SELECT auth.uid()))
  WITH CHECK (customer_id = (SELECT auth.uid()));

REVOKE ALL ON public.notification_preferences, public.author_follows FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences, public.author_follows TO authenticated;
