-- ============================================================
-- Camarillo Bookworm - books: public columns only (step 2 of 2)
-- ============================================================
-- Run this AFTER books-public-columns-1-prepare.sql AND after the site
-- build that names its columns is live. From the moment this commits,
-- anon/authenticated requests for select=* (or any withheld column, whether
-- selected, filtered on or ordered by) fail with 42501 permission denied.
--
-- What the publishable key can still read is the allow-list below. Anything
-- not on it - cost, avg_cost, primary_vendor, purchase_discount, sales_*,
-- qty_purchased_*, last_ordered / last_received / last_sold_date,
-- inventory_count, reserved_count, total_sold - is service-role only.
-- A column added to books later is withheld until it is added here, which
-- is the right way round.
--
-- Not affected: the secret/service-role key (POS sync, scripts/), and the
-- SECURITY DEFINER functions from rls-lockdown.sql (reserve_book etc.),
-- which run as the table owner.
--
-- To undo in a hurry:  GRANT SELECT ON books TO anon, authenticated;
-- ============================================================

BEGIN;

-- Refuse to run before step 1: the site would have nothing to read stock
-- or ranking from.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'stock_level'
  ) THEN
    RAISE EXCEPTION 'Run books-public-columns-1-prepare.sql first.';
  END IF;
END $$;

-- Supabase grants ALL on every public table to anon and authenticated.
-- RLS already blocks their writes (no write policies), but TRUNCATE is not
-- subject to RLS and none of it is needed, so take the lot away.
REVOKE ALL ON books FROM PUBLIC, anon, authenticated;

-- Grant SELECT on the allow-list. Built from the columns that actually
-- exist, because this database has drifted from the migration files before
-- (total_sold, list_price) and GRANT fails on a column that is not there.
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'books'
    AND column_name = ANY (ARRAY[
      -- identity
      'id', 'isbn', 'isbn10',
      -- bibliographic
      'title', 'subtitle', 'author', 'author_last', 'authors', 'illustrator', 'contributors',
      'edition', 'description', 'cover_url', 'category', 'genre', 'book_type',
      'publisher', 'publication_date', 'page_count', 'tags',
      -- what the customer pays
      'price', 'list_price',
      -- availability, as shown on the site
      'status', 'stock_level', 'is_limited_preorder', 'preorder_cutoff_date',
      -- staff picks
      'is_staff_pick', 'staff_reviewer', 'staff_quote',
      -- ordering without the figures behind it
      'sales_rank_mtd', 'sales_rank_ytd', 'sales_rank_past12',
      -- housekeeping (sitemap lastmod, cover backfill)
      'created_at', 'updated_at'
    ]);

  EXECUTE format('GRANT SELECT (%s) ON public.books TO anon, authenticated', cols);
END $$;

-- bestseller_rankings (add-bestseller-rankings.sql) has not been created on
-- this database, but if it ever is, units_sold is the same leak. The site
-- only reads book_id and rank.
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'bestseller_rankings') THEN
    REVOKE ALL ON bestseller_rankings FROM PUBLIC, anon, authenticated;
    GRANT SELECT (book_id, period, rank, updated_at)
      ON bestseller_rankings TO anon, authenticated;
  END IF;
END $$;

-- ------------------------------------------------------------
-- Verify, then commit
-- ------------------------------------------------------------
DO $$
DECLARE
  r       text;
  leaked  text[];
  blocked text[];
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    -- Nothing business-sensitive may be readable...
    SELECT array_agg(column_name::text) INTO leaked
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'books'
      AND (column_name ~ '^(cost|avg_cost|primary_vendor|purchase_discount|inventory_count|reserved_count|total_sold)$'
        OR column_name ~ '^(sales_(total|ytd|mtd|past12)|qty_purchased_|last_(ordered|received|sold))')
      AND has_column_privilege(r, 'public.books', column_name, 'SELECT');
    IF leaked IS NOT NULL THEN
      RAISE EXCEPTION '% can still read: %', r, leaked;
    END IF;

    -- ...and everything the site names must be.
    SELECT array_agg(c) INTO blocked
    FROM unnest(ARRAY[
      'id', 'isbn', 'title', 'author', 'author_last', 'description', 'price',
      'list_price', 'cover_url', 'category', 'genre', 'book_type', 'publisher',
      'publication_date', 'page_count', 'stock_level', 'status', 'is_staff_pick',
      'staff_reviewer', 'staff_quote', 'is_limited_preorder',
      'preorder_cutoff_date', 'tags', 'sales_rank_mtd', 'sales_rank_ytd',
      'sales_rank_past12', 'updated_at'
    ]) AS c
    WHERE NOT has_column_privilege(r, 'public.books', c, 'SELECT');
    IF blocked IS NOT NULL THEN
      RAISE EXCEPTION '% cannot read columns the site needs: %', r, blocked;
    END IF;
  END LOOP;
END $$;

-- What the publishable key can read now. Eyeball it before moving on.
SELECT column_name,
       has_column_privilege('anon', 'public.books', column_name, 'SELECT') AS anon_can_read
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'books'
ORDER BY anon_can_read DESC, ordinal_position;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Then check from outside (replace KEY with the publishable key):
--   curl 'https://lildbdxabljkoynvpflu.supabase.co/rest/v1/books?select=cost&limit=1' -H 'apikey: KEY'
--     -> 401/403 with code 42501, permission denied
--   curl 'https://lildbdxabljkoynvpflu.supabase.co/rest/v1/books?select=id,title,stock_level&limit=1' -H 'apikey: KEY'
--     -> one row
