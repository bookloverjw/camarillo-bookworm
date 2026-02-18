-- ============================================================
-- Bestseller Rankings – pre-computed daily at 8 PM Pacific
-- ============================================================
-- Instead of computing sales rankings on every page load
-- (expensive joins across transaction_items / order_items),
-- this table caches ranked results for three time windows.
-- A pg_cron job refreshes it nightly.
-- ============================================================

-- 1. Table ---------------------------------------------------

CREATE TABLE IF NOT EXISTS bestseller_rankings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('month', 'quarter', 'year')),
  units_sold INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(book_id, period)
);

CREATE INDEX IF NOT EXISTS idx_bestseller_rankings_period_rank
  ON bestseller_rankings(period, rank);

-- 2. RLS -----------------------------------------------------

ALTER TABLE bestseller_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read bestseller rankings"
  ON bestseller_rankings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role can do anything (needed by the refresh function)
CREATE POLICY "Service role full access on bestseller rankings"
  ON bestseller_rankings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Refresh function ----------------------------------------
-- Merges sales from transaction_items (POS, keyed by book_id)
-- and order_items (website, keyed by isbn→books.isbn) for each
-- period window.  Bulk orders (qty > 20) are excluded.
-- Falls back to books.total_sold when no transactional data exists.

CREATE OR REPLACE FUNCTION refresh_bestseller_rankings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER          -- runs as table owner, bypasses RLS
SET search_path = public
AS $$
DECLARE
  period_name TEXT;
  period_days INTEGER;
  cutoff TIMESTAMPTZ;
  periods TEXT[]   := ARRAY['month', 'quarter', 'year'];
  days    INTEGER[] := ARRAY[30, 90, 365];
BEGIN
  -- Wipe stale rankings
  DELETE FROM bestseller_rankings;

  FOR i IN 1..array_length(periods, 1) LOOP
    period_name := periods[i];
    period_days := days[i];
    cutoff      := NOW() - (period_days || ' days')::INTERVAL;

    INSERT INTO bestseller_rankings (book_id, period, units_sold, rank, updated_at)
    WITH tx_sales AS (
      -- POS sales (book_id based)
      SELECT ti.book_id, SUM(ti.quantity)::INTEGER AS units
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      WHERE t.created_at >= cutoff
        AND ti.quantity <= 20
        AND ti.book_id IS NOT NULL
      GROUP BY ti.book_id
    ),
    order_sales AS (
      -- Website sales (isbn based → mapped to book_id)
      SELECT b.id AS book_id, SUM(oi.quantity)::INTEGER AS units
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN books b ON b.isbn = oi.isbn
      WHERE o.created_at >= cutoff
        AND oi.quantity <= 20
        AND oi.isbn IS NOT NULL
      GROUP BY b.id
    ),
    merged AS (
      SELECT
        COALESCE(tx.book_id, os.book_id) AS book_id,
        COALESCE(tx.units, 0) + COALESCE(os.units, 0) AS units_sold
      FROM tx_sales tx
      FULL OUTER JOIN order_sales os ON tx.book_id = os.book_id
    ),
    with_fallback AS (
      -- Books that had actual sales in the window
      SELECT book_id, units_sold FROM merged
      WHERE units_sold > 0
      UNION ALL
      -- Fallback: books with a total_sold counter but no transactional data
      SELECT b.id, b.total_sold
      FROM books b
      WHERE b.total_sold > 0
        AND NOT EXISTS (
          SELECT 1 FROM merged m WHERE m.book_id = b.id AND m.units_sold > 0
        )
    ),
    ranked AS (
      SELECT
        book_id,
        units_sold,
        ROW_NUMBER() OVER (ORDER BY units_sold DESC, book_id) AS rnk
      FROM with_fallback
    )
    SELECT book_id, period_name, units_sold, rnk::INTEGER, NOW()
    FROM ranked;
  END LOOP;
END;
$$;

-- 4. Seed the table with an initial run ----------------------
SELECT refresh_bestseller_rankings();

-- 5. Schedule nightly refresh via pg_cron --------------------
-- 8 PM Pacific = cron expression with timezone.
-- Requires the pg_cron extension (enable in Supabase Dashboard
-- → Database → Extensions → search "pg_cron" → enable).
--
-- Uncomment and run after enabling pg_cron:
--
-- SELECT cron.schedule(
--   'refresh-bestseller-rankings',   -- job name
--   '0 20 * * *',                    -- 8:00 PM every day
--   $$SELECT refresh_bestseller_rankings()$$
-- );
--
-- To set the timezone to Pacific (requires cron.schedule_in_database):
-- UPDATE cron.job
-- SET nodename = '',
--     database = current_database()
-- WHERE jobname = 'refresh-bestseller-rankings';
--
-- NOTE: If pg_cron is not available, call refresh_bestseller_rankings()
-- manually or from an external scheduler (e.g. GitHub Actions, Supabase
-- Edge Function with a cron trigger).
