-- ============================================================
-- The Bookworm - "Most wished for": what readers are saving
-- ============================================================
-- Wishlists are private (owner-only under RLS), so the site can't count
-- them from the browser. This SECURITY DEFINER function returns only
-- aggregate counts per ISBN - which books, and how many distinct customers
-- have saved each - never who saved what. It is read by /api/most-wished.
--
-- Run in the Supabase SQL editor. Safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.most_wished(max_rows int DEFAULT 24)
RETURNS TABLE (isbn text, title text, author text, cover_url text, wishers bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.isbn,
    (array_agg(i.title     ORDER BY i.added_at DESC))[1]                                   AS title,
    (array_agg(i.author    ORDER BY i.added_at DESC))[1]                                   AS author,
    (array_agg(i.cover_url ORDER BY i.added_at DESC) FILTER (WHERE i.cover_url IS NOT NULL))[1] AS cover_url,
    count(DISTINCT w.customer_id)                                                           AS wishers
  FROM wishlist_items i
  JOIN wishlists w ON w.id = i.wishlist_id
  WHERE i.isbn ~ '^97[89][0-9]{10}$'
  GROUP BY i.isbn
  ORDER BY wishers DESC, max(i.added_at) DESC
  LIMIT least(greatest(max_rows, 1), 100);
$$;

REVOKE ALL ON FUNCTION public.most_wished(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.most_wished(int) TO anon, authenticated;
