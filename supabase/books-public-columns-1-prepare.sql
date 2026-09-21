-- ============================================================
-- Camarillo Bookworm - books: public columns only (step 1 of 2)
-- ============================================================
-- The problem: RLS on books is "public read", and RLS is row-level only.
-- Anyone holding the publishable key (it ships in the browser bundle) can
--   GET /rest/v1/books?select=*
-- and walk away with cost, primary_vendor, purchase_discount and every
-- sales counter for the whole catalogue.
--
-- The fix is column-level privileges: anon/authenticated lose SELECT on the
-- table and get it back on the customer-facing columns only. That happens
-- in step 2. This file is the groundwork, and is purely additive - running
-- it changes nothing for the live site:
--
--   - books.stock_level       0 / 1 / 2 ("2" = two or more). All the site
--                             ever showed of inventory_count: Available to
--                             Order / Only 1 Left / In Store.
--   - books.sales_rank_*      position by units sold, in place of the units
--                             themselves, for bestseller and "you might also
--                             like" ordering.
--   - book_availability()     copies a shopper could add to a cart now, in
--                             place of reading inventory_count/reserved_count.
--
-- ORDER MATTERS:
--   1. Run this file in the Supabase SQL Editor.
--   2. Deploy the site build that reads the new columns (the old build
--      keeps working after this file; the new build does not work before it).
--   3. Run books-public-columns-2-lockdown.sql. The old build's select=*
--      stops working at that moment, which is why the deploy comes first.
-- ============================================================

BEGIN;

-- The site names its columns from now on, so every column it names has to
-- exist. list_price comes from isbndb-prices-and-coming-soon.sql, which has
-- not been run on this database yet; same definition, harmless if it has.
ALTER TABLE books ADD COLUMN IF NOT EXISTS list_price numeric(10,2);

-- ------------------------------------------------------------
-- 1. Stock level - generated, so it can never drift from inventory_count
-- ------------------------------------------------------------
ALTER TABLE books ADD COLUMN IF NOT EXISTS stock_level smallint
  GENERATED ALWAYS AS (LEAST(GREATEST(COALESCE(inventory_count, 0), 0), 2)) STORED;

-- ------------------------------------------------------------
-- 2. Sales ranks
-- ------------------------------------------------------------
-- 1 = best seller. NULL = no sales in that window. Titles with equal sales
-- share a rank; the site breaks ties itself (trailing-year rank, then title).
ALTER TABLE books ADD COLUMN IF NOT EXISTS sales_rank_mtd    integer;
ALTER TABLE books ADD COLUMN IF NOT EXISTS sales_rank_ytd    integer;
ALTER TABLE books ADD COLUMN IF NOT EXISTS sales_rank_past12 integer;

CREATE INDEX IF NOT EXISTS idx_books_sales_rank_past12 ON books (sales_rank_past12);

-- Recomputes the three ranks from the POS counters and returns how many
-- rows moved. Only rows whose rank actually changed are written, so a
-- refresh after a quiet day touches next to nothing.
--
-- The counters only change when the POS sync writes them, so run this at
-- the end of each sync (service-role: POST /rest/v1/rpc/refresh_book_sales_ranks)
-- or nightly via pg_cron - see the end of this file.
CREATE OR REPLACE FUNCTION refresh_book_sales_ranks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      CASE WHEN COALESCE(sales_mtd, 0) > 0
        THEN (rank() OVER (ORDER BY COALESCE(sales_mtd, 0) DESC))::integer END AS r_mtd,
      CASE WHEN COALESCE(sales_ytd, 0) > 0
        THEN (rank() OVER (ORDER BY COALESCE(sales_ytd, 0) DESC))::integer END AS r_ytd,
      CASE WHEN COALESCE(sales_past12, 0) > 0
        THEN (rank() OVER (ORDER BY COALESCE(sales_past12, 0) DESC))::integer END AS r_past12
    FROM books
  )
  UPDATE books b
  SET sales_rank_mtd    = r.r_mtd,
      sales_rank_ytd    = r.r_ytd,
      sales_rank_past12 = r.r_past12
  FROM ranked r
  WHERE b.id = r.id
    AND (b.sales_rank_mtd    IS DISTINCT FROM r.r_mtd
      OR b.sales_rank_ytd    IS DISTINCT FROM r.r_ytd
      OR b.sales_rank_past12 IS DISTINCT FROM r.r_past12);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION refresh_book_sales_ranks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_book_sales_ranks() TO service_role;

-- Seed the ranks now.
SELECT refresh_book_sales_ranks() AS books_ranked;

-- ------------------------------------------------------------
-- 3. Availability without the counts
-- ------------------------------------------------------------
-- Copies not held in someone else's cart, capped at 20 - the most
-- reserve_book() will hold in one go, so the cap costs the cart nothing.
-- NULL when the book does not exist. Display only: reserve_book() is still
-- the authoritative, race-safe gate.
CREATE OR REPLACE FUNCTION book_availability(p_book_id text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LEAST(GREATEST(COALESCE(inventory_count, 0) - COALESCE(reserved_count, 0), 0), 20)
  FROM books
  WHERE id = p_book_id;
$$;

REVOKE ALL ON FUNCTION book_availability(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION book_availability(text) TO anon, authenticated;

-- ------------------------------------------------------------
-- 4. Verify, then commit
-- ------------------------------------------------------------
DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(c) INTO missing
  FROM unnest(ARRAY['list_price', 'stock_level',
                    'sales_rank_mtd', 'sales_rank_ytd', 'sales_rank_past12']) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'books' AND column_name = c
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Columns missing after prepare: %', missing;
  END IF;
END $$;

SELECT
  count(*)                                        AS books,
  count(*) FILTER (WHERE stock_level > 0)         AS in_stock,
  count(sales_rank_mtd)                           AS ranked_this_month,
  count(sales_rank_ytd)                           AS ranked_this_year,
  count(sales_rank_past12)                        AS ranked_past_12_months
FROM books;

COMMIT;

-- New columns and functions are invisible to the REST API until PostgREST
-- reloads its schema cache.
NOTIFY pgrst, 'reload schema';

-- Keep the ranks fresh nightly if pg_cron is available
-- (Database > Extensions > enable pg_cron first, then uncomment):
-- SELECT cron.schedule('refresh-book-sales-ranks', '15 3 * * *',
--                      $$SELECT refresh_book_sales_ranks()$$);
