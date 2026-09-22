-- ============================================================
-- Camarillo Bookworm - Consolidated RLS lockdown
-- ============================================================
-- Run this in the Supabase SQL Editor.
--
-- As of 2026-09-21 this had never been applied to production. What was
-- there instead: dashboard-template policies - customers, addresses,
-- orders, gift cards, newsletter emails and wishlists readable AND
-- writable by anyone holding the publishable key (it ships in the browser),
-- and a batch of tables open to any signed-up account.
--
-- Model:
--   - Catalog tables (books, events, staff, picks): public read only.
--     (What columns of books are readable is a separate, column-level
--     matter: books-public-columns-2-lockdown.sql.)
--   - Customer-owned tables (customers, addresses, orders, transactions,
--     wishlists, registrations): anyone may INSERT where guest checkout
--     needs it; reads and updates are scoped to the signed-in owner
--     (customers.id = auth.uid(), set by AuthContext on signup).
--   - Form tables (contact, newsletter): INSERT only. Duplicate emails
--     surface as unique-violation 23505, which the app already handles.
--   - Gift cards: NO direct client access. Balance checks go through
--     the check_gift_card_balance() function below; issuing/redeeming
--     is service-role only (do it from a server, never the browser).
--   - Inventory: NO direct client writes. The browser calls the atomic
--     functions below (reserve/release/confirm), which are race-safe
--     and keep books.reserved_count consistent.
--   - Back-office tables the website never touches (inventory, products,
--     purchase orders, special orders, order_payments): active staff
--     (is_active_staff(), from the inventory app) and the service role
--     only. "Any signed-in user" is not a boundary - anyone can sign up.
--   - The inventory app's own tables (inventory_sessions, *_devices,
--     *_scan_events) and store_credentials / store_settings /
--     credential_audit_log already have proper policies. NOT TOUCHED.
--
-- Known behavior changes (intentional):
--   - Guest checkout can no longer look up an existing customer by
--     email; it just creates a new customer row. (The old lookup was
--     the same hole that let anyone dump the customer list.)
--   - The browser can no longer insert gift_cards rows. The gift card
--     page already carries on without the row ("continue anyway for
--     demo"); real issuing needs a server.
--   - scripts/enrich-book-tags.mjs can no longer write books with the
--     anon key; run it with the service-role key instead.
--
-- Undo (all of it): re-run the previous policies from the dashboard's
-- history, or per table: CREATE POLICY ... USING (true).
-- ============================================================

-- ------------------------------------------------------------
-- 0. Run as one transaction
-- ------------------------------------------------------------
-- Section 0 drops every managed policy before section 1 recreates them.
-- If the script fails in between, RLS is on with nothing allowed and the
-- site goes dark - so either all of this lands or none of it does.
BEGIN;

-- confirm_reservation() below writes books.total_sold. The column is
-- missing on this database (add-total-sold.sql added tags but not this),
-- so checkout would fail at runtime without it.
ALTER TABLE books ADD COLUMN IF NOT EXISTS total_sold INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_books_total_sold ON books(total_sold DESC);

-- ------------------------------------------------------------
-- 0b. Clean slate - on the tables this file manages only
-- ------------------------------------------------------------
-- The inventory app's tables and the credentials/settings tables keep
-- their existing (already correct) policies.
DROP TABLE IF EXISTS _managed;
CREATE TEMP TABLE _managed (tbl text PRIMARY KEY);
INSERT INTO _managed VALUES
  ('books'), ('events'), ('staff_members'), ('staff_picks'),
  ('customers'), ('customer_addresses'),
  ('orders'), ('order_items'), ('transactions'), ('transaction_items'),
  ('wishlists'), ('wishlist_items'), ('event_registrations'),
  ('newsletter_subscribers'), ('contact_submissions'),
  ('gift_cards'), ('gift_card_transactions'),
  ('inventory_reservations'),
  -- back-office tables: staff / service role only
  ('inventory'), ('products'), ('product_variants'),
  ('purchase_orders'), ('purchase_order_items'), ('special_orders'),
  ('order_payments');

-- Only tables that exist: this database and the migration files have
-- drifted before, and CREATE POLICY on a missing table aborts the lot.
DELETE FROM _managed m
WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = m.tbl);

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT p.schemaname, p.tablename, p.policyname
    FROM pg_policies p JOIN _managed m ON m.tbl = p.tablename
    WHERE p.schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;

  FOR pol IN SELECT tbl FROM _managed LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', pol.tbl);
  END LOOP;
END $$;

-- Policies below are created only where the table exists.
CREATE OR REPLACE FUNCTION pg_temp.policy(p_table text, p_sql text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM _managed WHERE tbl = p_table) THEN
    EXECUTE p_sql;
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 1. Public read-only catalog
-- ------------------------------------------------------------
-- Which columns of books are readable is set by column grants
-- (books-public-columns-2-lockdown.sql); this policy only says every row is.
SELECT pg_temp.policy('books',
  $p$CREATE POLICY "public read books" ON books FOR SELECT USING (true)$p$);
-- Drafts stay private. The site already filters on is_published itself.
SELECT pg_temp.policy('events',
  $p$CREATE POLICY "public read events" ON events FOR SELECT USING (is_published = true)$p$);
-- Former staff stay private. (show_on_website exists too, but nothing on
-- the site reads it and the old effective rule ignored it; flip to
-- "AND show_on_website = true" once it is known to be filled in.)
SELECT pg_temp.policy('staff_members',
  $p$CREATE POLICY "public read staff" ON staff_members FOR SELECT USING (is_active = true)$p$);
SELECT pg_temp.policy('staff_picks',
  $p$CREATE POLICY "public read picks" ON staff_picks FOR SELECT USING (true)$p$);
-- No INSERT/UPDATE/DELETE policies: catalog writes are service-role only
-- (POS sync, enrichment scripts, admin tools).

-- ------------------------------------------------------------
-- 2. Customers - own row only
-- ------------------------------------------------------------
-- Guest checkout inserts customer rows without a session; keep INSERT open.
SELECT pg_temp.policy('customers', $p$
  CREATE POLICY "public insert customers" ON customers FOR INSERT WITH CHECK (true)$p$);
SELECT pg_temp.policy('customers', $p$
  CREATE POLICY "own read customers" ON customers FOR SELECT
    USING (id::text = (SELECT auth.uid())::text)$p$);
SELECT pg_temp.policy('customers', $p$
  CREATE POLICY "own update customers" ON customers FOR UPDATE
    USING (id::text = (SELECT auth.uid())::text)
    WITH CHECK (id::text = (SELECT auth.uid())::text)$p$);

SELECT pg_temp.policy('customer_addresses', $p$
  CREATE POLICY "own addresses" ON customer_addresses FOR ALL
    USING (customer_id::text = (SELECT auth.uid())::text)
    WITH CHECK (customer_id::text = (SELECT auth.uid())::text)$p$);

-- ------------------------------------------------------------
-- 3. Orders & financial records - insert for checkout, read own
-- ------------------------------------------------------------
SELECT pg_temp.policy('orders', $p$
  CREATE POLICY "public insert orders" ON orders FOR INSERT WITH CHECK (true)$p$);
SELECT pg_temp.policy('orders', $p$
  CREATE POLICY "own read orders" ON orders FOR SELECT
    USING (customer_id::text = (SELECT auth.uid())::text)$p$);
-- No UPDATE policy: status changes are service-role only.

SELECT pg_temp.policy('order_items', $p$
  CREATE POLICY "public insert order_items" ON order_items FOR INSERT WITH CHECK (true)$p$);
SELECT pg_temp.policy('order_items', $p$
  CREATE POLICY "own read order_items" ON order_items FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.customer_id::text = (SELECT auth.uid())::text
    ))$p$);

SELECT pg_temp.policy('transactions', $p$
  CREATE POLICY "public insert transactions" ON transactions FOR INSERT WITH CHECK (true)$p$);
SELECT pg_temp.policy('transactions', $p$
  CREATE POLICY "own read transactions" ON transactions FOR SELECT
    USING (customer_id::text = (SELECT auth.uid())::text)$p$);
SELECT pg_temp.policy('transaction_items', $p$
  CREATE POLICY "public insert transaction_items" ON transaction_items FOR INSERT WITH CHECK (true)$p$);
SELECT pg_temp.policy('transaction_items', $p$
  CREATE POLICY "own read transaction_items" ON transaction_items FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_items.transaction_id
        AND t.customer_id::text = (SELECT auth.uid())::text
    ))$p$);

-- ------------------------------------------------------------
-- 4. Wishlists - owner only
-- ------------------------------------------------------------
SELECT pg_temp.policy('wishlists', $p$
  CREATE POLICY "own wishlists" ON wishlists FOR ALL
    USING (customer_id::text = (SELECT auth.uid())::text)
    WITH CHECK (customer_id::text = (SELECT auth.uid())::text)$p$);
SELECT pg_temp.policy('wishlist_items', $p$
  CREATE POLICY "own wishlist_items" ON wishlist_items FOR ALL
    USING (EXISTS (
      SELECT 1 FROM wishlists w
      WHERE w.id = wishlist_items.wishlist_id
        AND w.customer_id::text = (SELECT auth.uid())::text
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM wishlists w
      WHERE w.id = wishlist_items.wishlist_id
        AND w.customer_id::text = (SELECT auth.uid())::text
    ))$p$);

-- ------------------------------------------------------------
-- 5. Event registrations - anyone can register, read own
-- ------------------------------------------------------------
SELECT pg_temp.policy('event_registrations', $p$
  CREATE POLICY "public insert registrations" ON event_registrations FOR INSERT WITH CHECK (true)$p$);
SELECT pg_temp.policy('event_registrations', $p$
  CREATE POLICY "own read registrations" ON event_registrations FOR SELECT
    USING (customer_id::text = (SELECT auth.uid())::text)$p$);

-- ------------------------------------------------------------
-- 6. Forms - insert only
-- ------------------------------------------------------------
SELECT pg_temp.policy('newsletter_subscribers', $p$
  CREATE POLICY "public insert newsletter" ON newsletter_subscribers FOR INSERT WITH CHECK (true)$p$);
SELECT pg_temp.policy('contact_submissions', $p$
  CREATE POLICY "public insert contact" ON contact_submissions FOR INSERT WITH CHECK (true)$p$);
-- Duplicate newsletter emails raise 23505 (already handled in the app);
-- keep a unique index on the email column. If the table already holds
-- duplicates the index cannot be built - warn and carry on rather than
-- aborting the whole lockdown over a mailing list.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _managed WHERE tbl = 'newsletter_subscribers') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_newsletter_email
      ON newsletter_subscribers (lower(email));
  END IF;
EXCEPTION WHEN unique_violation THEN
  RAISE WARNING 'uq_newsletter_email not created: newsletter_subscribers already contains duplicate emails. De-duplicate, then create the index separately.';
END $$;

-- ------------------------------------------------------------
-- 6b. Back office - active staff and service role only
-- ------------------------------------------------------------
-- These carried the dashboard template "Enable all for authenticated
-- users". The website never reads them. If the inventory app's
-- is_active_staff() exists, staff keep full access; otherwise they are
-- service-role only until it does (RLS on, no policies = denied).
DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'is_active_staff') THEN
    RAISE WARNING 'is_active_staff() not found: back-office tables are service-role only.';
    RETURN;
  END IF;
  FOR t IN
    SELECT tbl FROM _managed WHERE tbl IN (
      'inventory', 'products', 'product_variants', 'purchase_orders',
      'purchase_order_items', 'special_orders', 'order_payments',
      -- the POS side of the sales tables, alongside the customer policies above
      'transactions', 'transaction_items')
  LOOP
    EXECUTE format('CREATE POLICY "staff all" ON public.%I FOR ALL TO authenticated '
                   'USING (is_active_staff()) WITH CHECK (is_active_staff())', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 7. Gift cards - no direct client access at all
-- ------------------------------------------------------------
-- (RLS enabled above; zero policies = anon/authenticated fully denied.)
-- Balance checks go through this exact-match function:
-- Written against the table as it actually exists: the card is identified
-- by card_number and has an is_active flag. (An earlier draft assumed code
-- and status columns, which is why this file failed on its first run.)
--
-- The page strips spaces and dashes and uppercases what the customer types
-- before sending it, while the card itself may be stored as GC-1234-5678.
-- Normalising both sides means the format on the card never has to match
-- the format in the box. The table is small, so skipping the index is fine.
--
-- status is returned as text because that is what the page already reads:
-- anything other than 'active' is shown to the customer as the reason.
CREATE OR REPLACE FUNCTION check_gift_card_balance(p_code text)
RETURNS TABLE (current_balance numeric, status text, expires_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.current_balance::numeric,
    CASE WHEN g.is_active THEN 'active' ELSE 'inactive' END,
    g.expires_at::timestamptz
  FROM gift_cards g
  WHERE upper(regexp_replace(g.card_number::text, '[[:space:]-]', '', 'g'))
      = upper(regexp_replace(p_code,               '[[:space:]-]', '', 'g'));
$$;
REVOKE ALL ON FUNCTION check_gift_card_balance(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_gift_card_balance(text) TO anon, authenticated;

-- ------------------------------------------------------------
-- 8. Inventory - atomic, race-safe functions; no direct writes
-- ------------------------------------------------------------
-- (RLS enabled on inventory_reservations above with zero policies;
--  clients use these functions only.)

-- Reserve: single-statement availability check + increment holds a row
-- lock, so two shoppers cannot both take the last copy.
CREATE OR REPLACE FUNCTION reserve_book(
  p_book_id text,
  p_quantity int,
  p_session_id text
)
RETURNS TABLE (reservation_id text, expires_at timestamptz, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
  v_res_id text;
  v_expires timestamptz := now() + interval '30 minutes';
  v_available int;
BEGIN
  IF p_quantity < 1 OR p_quantity > 20 THEN
    RETURN QUERY SELECT NULL::text, NULL::timestamptz, 'Invalid quantity'::text;
    RETURN;
  END IF;

  UPDATE books
  SET reserved_count = COALESCE(reserved_count, 0) + p_quantity
  WHERE id = p_book_id
    AND COALESCE(inventory_count, 0) - COALESCE(reserved_count, 0) >= p_quantity;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    SELECT COALESCE(inventory_count, 0) - COALESCE(reserved_count, 0)
      INTO v_available FROM books WHERE id = p_book_id;
    RETURN QUERY SELECT NULL::text, NULL::timestamptz,
      CASE
        WHEN v_available IS NULL THEN 'Book not found'
        WHEN v_available <= 0 THEN 'This book is currently sold out or reserved by other shoppers'
        ELSE format('Only %s copies available', v_available)
      END;
    RETURN;
  END IF;

  INSERT INTO inventory_reservations (book_id, quantity, session_id, expires_at)
  VALUES (p_book_id, p_quantity, p_session_id, v_expires)
  RETURNING id INTO v_res_id;

  RETURN QUERY SELECT v_res_id, v_expires, NULL::text;
END;
$$;

-- Release by reservation id: decrements by the reservation's own quantity,
-- only if the row still existed - cannot double-decrement.
CREATE OR REPLACE FUNCTION release_reservation(p_reservation_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book_id text;
  v_qty int;
BEGIN
  DELETE FROM inventory_reservations
  WHERE id = p_reservation_id
  RETURNING book_id, quantity INTO v_book_id, v_qty;

  IF v_book_id IS NOT NULL THEN
    UPDATE books
    SET reserved_count = GREATEST(0, COALESCE(reserved_count, 0) - v_qty)
    WHERE id = v_book_id;
  END IF;
END;
$$;

-- Release a partial quantity from a reservation (cart quantity decrease).
CREATE OR REPLACE FUNCTION release_reservation_quantity(
  p_reservation_id text,
  p_quantity int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book_id text;
  v_released int;
BEGIN
  UPDATE inventory_reservations
  SET quantity = quantity - p_quantity
  WHERE id = p_reservation_id AND quantity > p_quantity
  RETURNING book_id, p_quantity INTO v_book_id, v_released;

  IF v_book_id IS NULL THEN
    -- Releasing everything (or more than held): drop the row entirely
    DELETE FROM inventory_reservations
    WHERE id = p_reservation_id
    RETURNING book_id, quantity INTO v_book_id, v_released;
  END IF;

  IF v_book_id IS NOT NULL THEN
    UPDATE books
    SET reserved_count = GREATEST(0, COALESCE(reserved_count, 0) - v_released)
    WHERE id = v_book_id;
  END IF;
END;
$$;

-- Grow an existing reservation (cart quantity increase), race-safe.
CREATE OR REPLACE FUNCTION grow_reservation(
  p_reservation_id text,
  p_quantity int
)
RETURNS TABLE (error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book_id text;
  v_updated int;
  v_available int;
BEGIN
  SELECT book_id INTO v_book_id
  FROM inventory_reservations WHERE id = p_reservation_id;

  IF v_book_id IS NULL THEN
    RETURN QUERY SELECT 'Reservation not found'::text;
    RETURN;
  END IF;

  UPDATE books
  SET reserved_count = COALESCE(reserved_count, 0) + p_quantity
  WHERE id = v_book_id
    AND COALESCE(inventory_count, 0) - COALESCE(reserved_count, 0) >= p_quantity;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    SELECT COALESCE(inventory_count, 0) - COALESCE(reserved_count, 0)
      INTO v_available FROM books WHERE id = v_book_id;
    RETURN QUERY SELECT
      CASE WHEN COALESCE(v_available, 0) <= 0
        THEN 'No more copies available'
        ELSE format('Only %s more available', v_available)
      END;
    RETURN;
  END IF;

  UPDATE inventory_reservations
  SET quantity = quantity + p_quantity,
      expires_at = now() + interval '30 minutes'
  WHERE id = p_reservation_id;

  RETURN QUERY SELECT NULL::text;
END;
$$;

-- Confirm purchase: consumes the reservation and decrements stock once.
-- reserved_count is only reduced by what the reservation actually held,
-- so calling paths cannot double-decrement.
CREATE OR REPLACE FUNCTION confirm_reservation(
  p_reservation_id text,
  p_book_id text,
  p_quantity int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserved_qty int := 0;
BEGIN
  DELETE FROM inventory_reservations
  WHERE id = p_reservation_id AND book_id = p_book_id
  RETURNING quantity INTO v_reserved_qty;

  UPDATE books
  SET inventory_count = GREATEST(0, COALESCE(inventory_count, 0) - p_quantity),
      reserved_count  = GREATEST(0, COALESCE(reserved_count, 0) - COALESCE(v_reserved_qty, 0)),
      total_sold      = COALESCE(total_sold, 0) + p_quantity
  WHERE id = p_book_id;
END;
$$;

-- Cleanup: releases expired reservations AND fixes the counter
-- (the old version deleted rows but leaked reserved_count).
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    DELETE FROM inventory_reservations
    WHERE expires_at < now()
    RETURNING book_id, quantity
  ),
  totals AS (
    SELECT book_id, SUM(quantity) AS qty FROM expired GROUP BY book_id
  )
  UPDATE books b
  SET reserved_count = GREATEST(0, COALESCE(b.reserved_count, 0) - t.qty)
  FROM totals t
  WHERE b.id = t.book_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION reserve_book(text, int, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION release_reservation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION release_reservation_quantity(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION grow_reservation(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION confirm_reservation(text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_expired_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reserve_book(text, int, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION release_reservation(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION release_reservation_quantity(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION grow_reservation(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION confirm_reservation(text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_reservations() TO anon, authenticated;

-- Schedule the cleanup every 10 minutes if pg_cron is available
-- (Database > Extensions > enable pg_cron first, then uncomment):
-- SELECT cron.schedule('cleanup-reservations', '*/10 * * * *',
--                      $$SELECT cleanup_expired_reservations()$$);

-- ------------------------------------------------------------
-- 9. Verify, then commit
-- ------------------------------------------------------------
-- Every function the browser calls must exist, or the feature that calls
-- it 404s. This is what went wrong before: the app shipped expecting
-- these, the SQL was never run, and the gift card balance check has been
-- broken ever since.
DO $$
DECLARE
  missing text[];
  open_pol text[];
BEGIN
  SELECT array_agg(f) INTO missing
  FROM unnest(ARRAY[
    'check_gift_card_balance', 'reserve_book', 'grow_reservation',
    'release_reservation', 'release_reservation_quantity',
    'confirm_reservation', 'cleanup_expired_reservations'
  ]) AS f
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = f
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Functions missing after lockdown: %', missing;
  END IF;

  -- No managed table may let everyone read, change or delete rows -
  -- only the catalog is public, and only for reading.
  SELECT array_agg(tablename || '.' || policyname) INTO open_pol
  FROM pg_policies p JOIN _managed m ON m.tbl = p.tablename
  WHERE p.schemaname = 'public'
    AND p.qual = 'true'
    AND p.cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL')
    AND p.tablename NOT IN ('books', 'staff_picks');
  IF open_pol IS NOT NULL THEN
    RAISE EXCEPTION 'Still open to everyone: %', open_pol;
  END IF;
END $$;

SELECT tablename, policyname, cmd, roles::text, qual AS using_expr
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

DROP TABLE _managed;

COMMIT;
