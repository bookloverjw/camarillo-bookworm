-- ============================================
-- Camarillo Bookworm - RLS Policies V2
-- ============================================
-- This version safely drops existing policies before creating new ones
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- HELPER: Drop all existing policies for a table
-- ============================================

-- ORDERS
DROP POLICY IF EXISTS "Allow public order creation" ON orders;
DROP POLICY IF EXISTS "Users can view orders" ON orders;
DROP POLICY IF EXISTS "Allow order updates" ON orders;
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Service role full access on orders" ON orders;

-- ORDER_ITEMS
DROP POLICY IF EXISTS "Allow public order_items creation" ON order_items;
DROP POLICY IF EXISTS "Allow viewing order items" ON order_items;
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;

-- BOOKS (if exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can view books" ON books;
  DROP POLICY IF EXISTS "Allow book updates" ON books;
  DROP POLICY IF EXISTS "Service role can manage books" ON books;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- INVENTORY_RESERVATIONS (if exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow inventory reservation operations" ON inventory_reservations;
  DROP POLICY IF EXISTS "Anyone can create reservations" ON inventory_reservations;
  DROP POLICY IF EXISTS "Anyone can view reservations" ON inventory_reservations;
  DROP POLICY IF EXISTS "Anyone can delete own reservations" ON inventory_reservations;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- GIFT_CARDS (if exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public gift card creation" ON gift_cards;
  DROP POLICY IF EXISTS "Allow public gift card lookup" ON gift_cards;
  DROP POLICY IF EXISTS "Allow public gift card lookup by code" ON gift_cards;
  DROP POLICY IF EXISTS "Allow gift card updates" ON gift_cards;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- GIFT_CARD_TRANSACTIONS (if exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public gift card transaction creation" ON gift_card_transactions;
  DROP POLICY IF EXISTS "Allow viewing gift card transactions" ON gift_card_transactions;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- CUSTOMERS (if exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public customer creation" ON customers;
  DROP POLICY IF EXISTS "Allow viewing customers" ON customers;
  DROP POLICY IF EXISTS "Allow customer updates" ON customers;
  DROP POLICY IF EXISTS "Users can view own profile" ON customers;
  DROP POLICY IF EXISTS "Users can update own profile" ON customers;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- CUSTOMER_ADDRESSES (if exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public address operations" ON customer_addresses;
  DROP POLICY IF EXISTS "Users can manage own addresses" ON customer_addresses;
  DROP POLICY IF EXISTS "Allow public address creation" ON customer_addresses;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- WISHLISTS (if exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow wishlist operations" ON wishlists;
  DROP POLICY IF EXISTS "Users can manage own wishlists" ON wishlists;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- WISHLIST_ITEMS (if exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow wishlist item operations" ON wishlist_items;
  DROP POLICY IF EXISTS "Users can manage own wishlist items" ON wishlist_items;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- EVENTS (if exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can view events" ON events;
  DROP POLICY IF EXISTS "Public can view published events" ON events;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- EVENT_REGISTRATIONS (if exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public event registration" ON event_registrations;
  DROP POLICY IF EXISTS "Allow viewing registrations" ON event_registrations;
  DROP POLICY IF EXISTS "Users can view own registrations" ON event_registrations;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- NEWSLETTER_SUBSCRIBERS (if exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public newsletter subscription" ON newsletter_subscribers;
  DROP POLICY IF EXISTS "Allow viewing subscribers" ON newsletter_subscribers;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- CONTACT_SUBMISSIONS (if exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public contact submissions" ON contact_submissions;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- STAFF_MEMBERS (if exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can view staff" ON staff_members;
  DROP POLICY IF EXISTS "Public can view active staff" ON staff_members;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- STAFF_PICKS (if exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can view staff picks" ON staff_picks;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================
-- NOW CREATE NEW POLICIES
-- ============================================

-- ORDERS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_select" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (true);

-- ORDER_ITEMS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_insert" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "order_items_select" ON order_items FOR SELECT USING (true);

-- BOOKS (if exists)
DO $$ BEGIN
  ALTER TABLE books ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "books_select" ON books FOR SELECT USING (true);
  CREATE POLICY "books_update" ON books FOR UPDATE USING (true);
  CREATE POLICY "books_insert" ON books FOR INSERT WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- INVENTORY_RESERVATIONS (if exists)
DO $$ BEGIN
  ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "inventory_reservations_all" ON inventory_reservations FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- GIFT_CARDS (if exists)
DO $$ BEGIN
  ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "gift_cards_insert" ON gift_cards FOR INSERT WITH CHECK (true);
  CREATE POLICY "gift_cards_select" ON gift_cards FOR SELECT USING (true);
  CREATE POLICY "gift_cards_update" ON gift_cards FOR UPDATE USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- GIFT_CARD_TRANSACTIONS (if exists)
DO $$ BEGIN
  ALTER TABLE gift_card_transactions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "gift_card_transactions_insert" ON gift_card_transactions FOR INSERT WITH CHECK (true);
  CREATE POLICY "gift_card_transactions_select" ON gift_card_transactions FOR SELECT USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- CUSTOMERS (if exists)
DO $$ BEGIN
  ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "customers_insert" ON customers FOR INSERT WITH CHECK (true);
  CREATE POLICY "customers_select" ON customers FOR SELECT USING (true);
  CREATE POLICY "customers_update" ON customers FOR UPDATE USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- CUSTOMER_ADDRESSES (if exists)
DO $$ BEGIN
  ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "customer_addresses_all" ON customer_addresses FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- WISHLISTS (if exists)
DO $$ BEGIN
  ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "wishlists_all" ON wishlists FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- WISHLIST_ITEMS (if exists)
DO $$ BEGIN
  ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "wishlist_items_all" ON wishlist_items FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- EVENTS (if exists)
DO $$ BEGIN
  ALTER TABLE events ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "events_select" ON events FOR SELECT USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- EVENT_REGISTRATIONS (if exists)
DO $$ BEGIN
  ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "event_registrations_insert" ON event_registrations FOR INSERT WITH CHECK (true);
  CREATE POLICY "event_registrations_select" ON event_registrations FOR SELECT USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- NEWSLETTER_SUBSCRIBERS (if exists)
DO $$ BEGIN
  ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "newsletter_subscribers_insert" ON newsletter_subscribers FOR INSERT WITH CHECK (true);
  CREATE POLICY "newsletter_subscribers_select" ON newsletter_subscribers FOR SELECT USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- CONTACT_SUBMISSIONS (if exists)
DO $$ BEGIN
  ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "contact_submissions_insert" ON contact_submissions FOR INSERT WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- STAFF_MEMBERS (if exists)
DO $$ BEGIN
  ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "staff_members_select" ON staff_members FOR SELECT USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- STAFF_PICKS (if exists)
DO $$ BEGIN
  ALTER TABLE staff_picks ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "staff_picks_select" ON staff_picks FOR SELECT USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================
-- Show results
-- ============================================
SELECT 'Policies created successfully!' as status;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
