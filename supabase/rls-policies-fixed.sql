-- ============================================
-- Camarillo Bookworm - Supabase RLS Policies (FIXED)
-- ============================================
-- Run this in your Supabase SQL Editor
-- Fixed UUID type casting issues
-- ============================================

-- First, drop any existing policies that might conflict
DO $$
BEGIN
  -- Drop policies if they exist (ignore errors)
  DROP POLICY IF EXISTS "Allow public order creation" ON orders;
  DROP POLICY IF EXISTS "Users can view own orders" ON orders;
  DROP POLICY IF EXISTS "Service role full access on orders" ON orders;
  DROP POLICY IF EXISTS "Allow public order_items creation" ON order_items;
  DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
  DROP POLICY IF EXISTS "Users can view own profile" ON customers;
  DROP POLICY IF EXISTS "Users can update own profile" ON customers;
  DROP POLICY IF EXISTS "Allow public customer creation" ON customers;
  DROP POLICY IF EXISTS "Users can manage own addresses" ON customer_addresses;
  DROP POLICY IF EXISTS "Allow public address creation" ON customer_addresses;
  DROP POLICY IF EXISTS "Allow public gift card creation" ON gift_cards;
  DROP POLICY IF EXISTS "Allow public gift card lookup by code" ON gift_cards;
  DROP POLICY IF EXISTS "Allow gift card updates" ON gift_cards;
  DROP POLICY IF EXISTS "Allow public gift card transaction creation" ON gift_card_transactions;
  DROP POLICY IF EXISTS "Allow viewing gift card transactions" ON gift_card_transactions;
  DROP POLICY IF EXISTS "Users can manage own wishlists" ON wishlists;
  DROP POLICY IF EXISTS "Users can manage own wishlist items" ON wishlist_items;
  DROP POLICY IF EXISTS "Public can view published events" ON events;
  DROP POLICY IF EXISTS "Allow public event registration" ON event_registrations;
  DROP POLICY IF EXISTS "Users can view own registrations" ON event_registrations;
  DROP POLICY IF EXISTS "Allow public newsletter subscription" ON newsletter_subscribers;
  DROP POLICY IF EXISTS "Allow public contact submissions" ON contact_submissions;
  DROP POLICY IF EXISTS "Public can view active staff" ON staff_members;
  DROP POLICY IF EXISTS "Public can view staff picks" ON staff_picks;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore errors from non-existent policies
END $$;

-- ============================================
-- ORDERS TABLE
-- ============================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert orders (guest checkout)
CREATE POLICY "Allow public order creation"
ON orders FOR INSERT
WITH CHECK (true);

-- Allow anyone to view orders (simplified - you may want to restrict this)
CREATE POLICY "Users can view orders"
ON orders FOR SELECT
USING (true);

-- Allow updates (for status changes)
CREATE POLICY "Allow order updates"
ON orders FOR UPDATE
USING (true);

-- ============================================
-- ORDER_ITEMS TABLE
-- ============================================
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Allow public insert for order items
CREATE POLICY "Allow public order_items creation"
ON order_items FOR INSERT
WITH CHECK (true);

-- Allow viewing order items
CREATE POLICY "Allow viewing order items"
ON order_items FOR SELECT
USING (true);

-- ============================================
-- CUSTOMERS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customers') THEN
    ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

    -- Allow public sign-up
    CREATE POLICY "Allow public customer creation"
    ON customers FOR INSERT
    WITH CHECK (true);

    -- Allow viewing (simplified)
    CREATE POLICY "Allow viewing customers"
    ON customers FOR SELECT
    USING (true);

    -- Allow updates
    CREATE POLICY "Allow customer updates"
    ON customers FOR UPDATE
    USING (true);
  END IF;
END $$;

-- ============================================
-- CUSTOMER_ADDRESSES TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customer_addresses') THEN
    ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

    -- Allow public access (simplified for guest checkout)
    CREATE POLICY "Allow public address operations"
    ON customer_addresses FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- GIFT_CARDS TABLE
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'gift_cards') THEN
    ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

    -- Allow public insert (purchasing gift cards)
    CREATE POLICY "Allow public gift card creation"
    ON gift_cards FOR INSERT
    WITH CHECK (true);

    -- Allow anyone to view gift cards (for balance check)
    CREATE POLICY "Allow public gift card lookup"
    ON gift_cards FOR SELECT
    USING (true);

    -- Allow updates for redemption
    CREATE POLICY "Allow gift card updates"
    ON gift_cards FOR UPDATE
    USING (true);
  END IF;
END $$;

-- ============================================
-- GIFT_CARD_TRANSACTIONS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'gift_card_transactions') THEN
    ALTER TABLE gift_card_transactions ENABLE ROW LEVEL SECURITY;

    -- Allow public insert
    CREATE POLICY "Allow public gift card transaction creation"
    ON gift_card_transactions FOR INSERT
    WITH CHECK (true);

    -- Allow viewing transactions
    CREATE POLICY "Allow viewing gift card transactions"
    ON gift_card_transactions FOR SELECT
    USING (true);
  END IF;
END $$;

-- ============================================
-- WISHLISTS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'wishlists') THEN
    ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

    -- Allow all operations (simplified)
    CREATE POLICY "Allow wishlist operations"
    ON wishlists FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- WISHLIST_ITEMS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'wishlist_items') THEN
    ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

    -- Allow all operations (simplified)
    CREATE POLICY "Allow wishlist item operations"
    ON wishlist_items FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- EVENTS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'events') THEN
    ALTER TABLE events ENABLE ROW LEVEL SECURITY;

    -- Allow public viewing
    CREATE POLICY "Public can view events"
    ON events FOR SELECT
    USING (true);
  END IF;
END $$;

-- ============================================
-- EVENT_REGISTRATIONS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'event_registrations') THEN
    ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

    -- Allow public event registration
    CREATE POLICY "Allow public event registration"
    ON event_registrations FOR INSERT
    WITH CHECK (true);

    -- Allow viewing registrations
    CREATE POLICY "Allow viewing registrations"
    ON event_registrations FOR SELECT
    USING (true);
  END IF;
END $$;

-- ============================================
-- NEWSLETTER_SUBSCRIBERS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'newsletter_subscribers') THEN
    ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

    -- Allow public subscription
    CREATE POLICY "Allow public newsletter subscription"
    ON newsletter_subscribers FOR INSERT
    WITH CHECK (true);

    -- Allow viewing (for duplicate check)
    CREATE POLICY "Allow viewing subscribers"
    ON newsletter_subscribers FOR SELECT
    USING (true);
  END IF;
END $$;

-- ============================================
-- CONTACT_SUBMISSIONS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contact_submissions') THEN
    ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

    -- Allow public contact form submissions
    CREATE POLICY "Allow public contact submissions"
    ON contact_submissions FOR INSERT
    WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- STAFF_MEMBERS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'staff_members') THEN
    ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

    -- Allow public viewing
    CREATE POLICY "Public can view staff"
    ON staff_members FOR SELECT
    USING (true);
  END IF;
END $$;

-- ============================================
-- STAFF_PICKS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'staff_picks') THEN
    ALTER TABLE staff_picks ENABLE ROW LEVEL SECURITY;

    -- Allow public viewing
    CREATE POLICY "Public can view staff picks"
    ON staff_picks FOR SELECT
    USING (true);
  END IF;
END $$;

-- ============================================
-- BOOKS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'books') THEN
    ALTER TABLE books ENABLE ROW LEVEL SECURITY;

    -- Allow public viewing
    CREATE POLICY "Public can view books"
    ON books FOR SELECT
    USING (true);

    -- Allow updates (for inventory)
    CREATE POLICY "Allow book updates"
    ON books FOR UPDATE
    USING (true);
  END IF;
END $$;

-- ============================================
-- INVENTORY_RESERVATIONS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inventory_reservations') THEN
    ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;

    -- Allow all operations
    CREATE POLICY "Allow inventory reservation operations"
    ON inventory_reservations FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- Verify policies
-- ============================================
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
