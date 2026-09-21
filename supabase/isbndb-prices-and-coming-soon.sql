-- ============================================================
-- Camarillo Bookworm - list prices and Coming Soon, from ISBNdb
-- ============================================================
-- Run in the Supabase SQL Editor, AFTER rls-lockdown.sql. Safe to re-run.
--
-- Filled by the scheduled job in .github/workflows/isbndb-refresh.yml:
--   - books.list_price: the publisher's current list price (ISBNdb msrp).
--     Kept apart from books.price, which is what the POS says we charge,
--     so the job never overwrites a shelf price. The site shows list_price
--     while purchases go through Bookshop.org, which charges list price.
--   - upcoming_books: forthcoming titles by authors on the NYT lists and
--     recent prize winners, for the homepage's Coming Soon.
-- ============================================================
BEGIN;

ALTER TABLE books ADD COLUMN IF NOT EXISTS list_price numeric(10,2);
ALTER TABLE books ADD COLUMN IF NOT EXISTS list_price_checked_at timestamptz;
-- The job re-checks whatever was checked longest ago, never-checked first.
CREATE INDEX IF NOT EXISTS idx_books_list_price_checked
  ON books (list_price_checked_at NULLS FIRST);

-- Bulk update, one call per batch. Every book in the batch is stamped as
-- checked, so a title ISBNdb has no price for doesn't jump the queue forever;
-- a missing price leaves the last known one in place.
CREATE OR REPLACE FUNCTION set_list_prices(p_prices jsonb)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH x AS (
    SELECT id, price FROM jsonb_to_recordset(p_prices) AS t(id text, price numeric)
  ), u AS (
    UPDATE books b
    SET list_price = COALESCE(x.price, b.list_price),
        list_price_checked_at = now()
    FROM x
    WHERE b.id = x.id
    RETURNING 1
  )
  SELECT count(*)::int FROM u;
$$;
-- Only the scheduled job, which uses the secret key, may call it.
REVOKE ALL ON FUNCTION set_list_prices(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_list_prices(jsonb) TO service_role;

CREATE TABLE IF NOT EXISTS upcoming_books (
  isbn             text PRIMARY KEY,
  title            text NOT NULL,
  author           text NOT NULL,
  publication_date date NOT NULL,
  cover_url        text,
  msrp             numeric(10,2),
  -- Why it's on the shelf: "New from an author on this week's NYT list".
  reason           text,
  catalog_id       text,
  refreshed_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_upcoming_books_date ON upcoming_books (publication_date);

ALTER TABLE upcoming_books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read upcoming" ON upcoming_books;
CREATE POLICY "public read upcoming" ON upcoming_books FOR SELECT USING (true);
-- No write policies: only the secret key (the scheduled job) writes here.

-- Verify
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'books' AND column_name IN ('list_price', 'list_price_checked_at')) AS book_columns_added,
  (SELECT count(*) FROM pg_proc WHERE proname = 'set_list_prices') AS function_created,
  (SELECT count(*) FROM information_schema.tables WHERE table_name = 'upcoming_books') AS table_created;

COMMIT;
