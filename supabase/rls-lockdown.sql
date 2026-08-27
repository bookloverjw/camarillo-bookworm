-- ============================================================
-- Camarillo Bookworm - Consolidated RLS lockdown
-- ============================================================
-- Run this in the Supabase SQL Editor. It REPLACES the three
-- earlier policy files (rls-policies.sql, rls-policies-fixed.sql,
-- rls-policies-v2.sql), which have been deleted from the repo.
--
-- Model:
--   - Catalog tables (books, events, staff, rankings): public read only.
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
--
-- Known behavior changes (intentional):
--   - Guest checkout can no longer look up an existing customer by
--     email; it just creates a new customer row. (The old lookup was
--     the same hole that let anyone dump the customer list.)
--   - scripts/enrich-book-tags.mjs can no longer write books with the
--     anon key; run it with the service-role key instead.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Drop every existing policy in public schema (clean slate)
-- ------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname NOT ILIKE '%bestseller%'  -- keep add-bestseller-rankings.sql policies
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- Helper to enable RLS only when the table exists
CREATE OR REPLACE FUNCTION _enable_rls_if_exists(tbl text)
RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = tbl) THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT _enable_rls_if_exists(t) FROM unnest(ARRAY[
  'books', 'events', 'staff_members', 'staff_picks',
  'customers', 'customer_addresses',
  'orders', 'order_items', 'transactions', 'transaction_items',
  'wishlists', 'wishlist_items', 'event_registrations',
  'newsletter_subscribers', 'contact_submissions',
  'gift_cards', 'gift_card_transactions',
  'inventory_reservations'
]) AS t;

DROP FUNCTION _enable_rls_if_exists(text);

-- ------------------------------------------------------------
-- 1. Public read-only catalog
-- ------------------------------------------------------------
CREATE POLICY "public read books"   ON books          FOR SELECT USING (true);
CREATE POLICY "public read events"  ON events         FOR SELECT USING (true);
CREATE POLICY "public read staff"   ON staff_members  FOR SELECT USING (true);
CREATE POLICY "public read picks"   ON staff_picks    FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policies: catalog writes are service-role only
-- (POS sync, enrichment scripts, admin tools).

-- ------------------------------------------------------------
-- 2. Customers - own row only
-- ------------------------------------------------------------
-- Guest checkout inserts customer rows without a session; keep INSERT open.
CREATE POLICY "public insert customers" ON customers FOR INSERT
  WITH CHECK (true);
CREATE POLICY "own read customers" ON customers FOR SELECT
  USING (id::text = (SELECT auth.uid())::text);
CREATE POLICY "own update customers" ON customers FOR UPDATE
  USING (id::text = (SELECT auth.uid())::text)
  WITH CHECK (id::text = (SELECT auth.uid())::text);

CREATE POLICY "own addresses" ON customer_addresses FOR ALL
  USING (customer_id::text = (SELECT auth.uid())::text)
  WITH CHECK (customer_id::text = (SELECT auth.uid())::text);

-- ------------------------------------------------------------
-- 3. Orders & financial records - insert for checkout, read own
-- ------------------------------------------------------------
CREATE POLICY "public insert orders" ON orders FOR INSERT
  WITH CHECK (true);
CREATE POLICY "own read orders" ON orders FOR SELECT
  USING (customer_id::text = (SELECT auth.uid())::text);
-- No UPDATE policy: status changes are service-role only.

CREATE POLICY "public insert order_items" ON order_items FOR INSERT
  WITH CHECK (true);
CREATE POLICY "own read order_items" ON order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
      AND o.customer_id::text = (SELECT auth.uid())::text
  ));

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    CREATE POLICY "public insert transactions" ON transactions FOR INSERT
      WITH CHECK (true);
    CREATE POLICY "own read transactions" ON transactions FOR SELECT
      USING (customer_id::text = (SELECT auth.uid())::text);
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'transaction_items') THEN
    CREATE POLICY "public insert transaction_items" ON transaction_items FOR INSERT
      WITH CHECK (true);
    CREATE POLICY "own read transaction_items" ON transaction_items FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM transactions t
        WHERE t.id = transaction_items.transaction_id
          AND t.customer_id::text = (SELECT auth.uid())::text
      ));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Wishlists - owner only
-- ------------------------------------------------------------
CREATE POLICY "own wishlists" ON wishlists FOR ALL
  USING (customer_id::text = (SELECT auth.uid())::text)
  WITH CHECK (customer_id::text = (SELECT auth.uid())::text);

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
  ));

-- ------------------------------------------------------------
-- 5. Event registrations - anyone can register, read own
-- ------------------------------------------------------------
CREATE POLICY "public insert registrations" ON event_registrations FOR INSERT
  WITH CHECK (true);
CREATE POLICY "own read registrations" ON event_registrations FOR SELECT
  USING (customer_id::text = (SELECT auth.uid())::text);

-- ------------------------------------------------------------
-- 6. Forms - insert only
-- ------------------------------------------------------------
CREATE POLICY "public insert newsletter" ON newsletter_subscribers FOR INSERT
  WITH CHECK (true);
CREATE POLICY "public insert contact" ON contact_submissions FOR INSERT
  WITH CHECK (true);
-- Duplicate newsletter emails raise 23505 (already handled in the app);
-- keep a unique index on the email column:
CREATE UNIQUE INDEX IF NOT EXISTS uq_newsletter_email
  ON newsletter_subscribers (lower(email));

-- ------------------------------------------------------------
-- 7. Gift cards - no direct client access at all
-- ------------------------------------------------------------
-- (RLS enabled above; zero policies = anon/authenticated fully denied.)
-- Balance checks go through this exact-match function:
CREATE OR REPLACE FUNCTION check_gift_card_balance(p_code text)
RETURNS TABLE (current_balance numeric, status text, expires_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.current_balance, g.status, g.expires_at
  FROM gift_cards g
  WHERE g.code = p_code;
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
-- 9. Verify
-- ------------------------------------------------------------
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
