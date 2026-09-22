-- ============================================================
-- Camarillo Bookworm - nightly jobs (pg_cron)
-- ============================================================
-- Run once in the Supabase SQL Editor. Safe to re-run: each schedule
-- is unscheduled first, so re-running replaces rather than duplicates.
--
--   refresh-book-sales-ranks   03:15 UTC daily. Recomputes books.sales_rank_*
--                              from the POS counters (books-public-columns-1-
--                              prepare.sql). Cheap: writes only rows whose
--                              rank changed, so a quiet night touches nothing.
--   cleanup-reservations       every 10 minutes. Releases expired cart
--                              holds and fixes books.reserved_count
--                              (rls-lockdown.sql).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule(jobid) FROM cron.job
WHERE jobname IN ('refresh-book-sales-ranks', 'cleanup-reservations');

SELECT cron.schedule('refresh-book-sales-ranks', '15 3 * * *',
                     $$SELECT refresh_book_sales_ranks()$$);
SELECT cron.schedule('cleanup-reservations', '*/10 * * * *',
                     $$SELECT cleanup_expired_reservations()$$);

-- What is scheduled now. Later runs show up in cron.job_run_details.
SELECT jobname, schedule, command, active FROM cron.job ORDER BY jobname;
