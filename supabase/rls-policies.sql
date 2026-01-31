-- ============================================
-- Camarillo Bookworm - Supabase RLS Policies
-- ============================================
-- Run this in your Supabase SQL Editor to enable
-- proper access to the database tables.
--
-- Go to: Supabase Dashboard > SQL Editor > New Query
-- Paste this entire file and run it.
-- ============================================

-- ============================================
-- ORDERS TABLE
-- ============================================
-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert orders (customers don't have to be logged in)
CREATE POLICY "Allow public order creation"
ON orders FOR INSERT
WITH CHECK (true);

-- Allow users to view their own orders
CREATE POLICY "Users can view own orders"
ON orders FOR SELECT
USING (auth.uid()::text = customer_id OR customer_id IS NULL);

-- Allow service role full access (for admin)
CREATE POLICY "Service role full access on orders"
ON orders FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- ORDER_ITEMS TABLE
-- ============================================
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Allow public insert for order items
CREATE POLICY "Allow public order_items creation"
ON order_items FOR INSERT
WITH CHECK (true);

-- Allow viewing order items for orders user owns
CREATE POLICY "Users can view own order items"
ON order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (auth.uid()::text = orders.customer_id OR orders.customer_id IS NULL)
  )
);

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
ON customers FOR SELECT
USING (auth.uid()::text = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON customers FOR UPDATE
USING (auth.uid()::text = id);

-- Allow public sign-up (insert)
CREATE POLICY "Allow public customer creation"
ON customers FOR INSERT
WITH CHECK (true);

-- ============================================
-- CUSTOMER_ADDRESSES TABLE
-- ============================================
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own addresses
CREATE POLICY "Users can manage own addresses"
ON customer_addresses FOR ALL
USING (auth.uid()::text = customer_id);

-- Allow public insert for guest checkout
CREATE POLICY "Allow public address creation"
ON customer_addresses FOR INSERT
WITH CHECK (true);

-- ============================================
-- GIFT_CARDS TABLE
-- ============================================
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

-- Allow public insert (purchasing gift cards)
CREATE POLICY "Allow public gift card creation"
ON gift_cards FOR INSERT
WITH CHECK (true);

-- Allow anyone to view gift cards by code (for balance check)
CREATE POLICY "Allow public gift card lookup by code"
ON gift_cards FOR SELECT
USING (true);

-- Allow updates for redemption
CREATE POLICY "Allow gift card updates"
ON gift_cards FOR UPDATE
USING (true);

-- ============================================
-- GIFT_CARD_TRANSACTIONS TABLE
-- ============================================
ALTER TABLE gift_card_transactions ENABLE ROW LEVEL SECURITY;

-- Allow public insert
CREATE POLICY "Allow public gift card transaction creation"
ON gift_card_transactions FOR INSERT
WITH CHECK (true);

-- Allow viewing transactions
CREATE POLICY "Allow viewing gift card transactions"
ON gift_card_transactions FOR SELECT
USING (true);

-- ============================================
-- WISHLISTS TABLE
-- ============================================
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- Users can manage their own wishlists
CREATE POLICY "Users can manage own wishlists"
ON wishlists FOR ALL
USING (auth.uid()::text = customer_id);

-- ============================================
-- WISHLIST_ITEMS TABLE
-- ============================================
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

-- Users can manage their own wishlist items
CREATE POLICY "Users can manage own wishlist items"
ON wishlist_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM wishlists
    WHERE wishlists.id = wishlist_items.wishlist_id
    AND auth.uid()::text = wishlists.customer_id
  )
);

-- ============================================
-- EVENTS TABLE
-- ============================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Allow public viewing of published events
CREATE POLICY "Public can view published events"
ON events FOR SELECT
USING (is_published = true);

-- ============================================
-- EVENT_REGISTRATIONS TABLE
-- ============================================
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;

-- Allow public event registration
CREATE POLICY "Allow public event registration"
ON event_registrations FOR INSERT
WITH CHECK (true);

-- Users can view their own registrations
CREATE POLICY "Users can view own registrations"
ON event_registrations FOR SELECT
USING (auth.uid()::text = customer_id OR customer_id IS NULL);

-- ============================================
-- NEWSLETTER_SUBSCRIBERS TABLE
-- ============================================
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow public subscription
CREATE POLICY "Allow public newsletter subscription"
ON newsletter_subscribers FOR INSERT
WITH CHECK (true);

-- ============================================
-- CONTACT_SUBMISSIONS TABLE
-- ============================================
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- Allow public contact form submissions
CREATE POLICY "Allow public contact submissions"
ON contact_submissions FOR INSERT
WITH CHECK (true);

-- ============================================
-- STAFF_MEMBERS TABLE
-- ============================================
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- Allow public viewing of active staff
CREATE POLICY "Public can view active staff"
ON staff_members FOR SELECT
USING (is_active = true);

-- ============================================
-- STAFF_PICKS TABLE
-- ============================================
ALTER TABLE staff_picks ENABLE ROW LEVEL SECURITY;

-- Allow public viewing of staff picks
CREATE POLICY "Public can view staff picks"
ON staff_picks FOR SELECT
USING (true);

-- ============================================
-- INVENTORY TABLE (if exists)
-- ============================================
-- Uncomment if you have an inventory table
/*
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view inventory"
ON inventory FOR SELECT
USING (true);

CREATE POLICY "Allow inventory updates"
ON inventory FOR UPDATE
USING (true);

CREATE POLICY "Allow inventory inserts"
ON inventory FOR INSERT
WITH CHECK (true);
*/

-- ============================================
-- INVENTORY_RESERVATIONS TABLE (if exists)
-- ============================================
-- Uncomment if you have this table
/*
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public inventory reservations"
ON inventory_reservations FOR ALL
USING (true)
WITH CHECK (true);
*/

-- ============================================
-- Verify policies were created
-- ============================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
