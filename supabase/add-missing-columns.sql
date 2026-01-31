-- ============================================
-- Add Missing Columns and Tables
-- ============================================
-- Run this in Supabase SQL Editor if you want
-- the full inventory tracking and shipping fields.
--
-- NOTE: The website will work WITHOUT these -
-- it stores shipping info as JSON in the notes field.
-- Only run this if you want dedicated columns.
-- ============================================

-- ============================================
-- ADD SHIPPING COLUMNS TO ORDERS TABLE
-- ============================================
-- These columns store customer/shipping info directly on the order
-- Useful for guest checkout and easier querying

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_option TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_first_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_last_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_1 TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_2 TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_city TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_state TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_country TEXT DEFAULT 'US';

-- ============================================
-- BOOKS TABLE (for inventory tracking)
-- ============================================
-- Create if not exists - stores book inventory

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  isbn TEXT UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  description TEXT,
  price DECIMAL(10, 2),
  cover_url TEXT,
  category TEXT,
  genre TEXT,
  book_type TEXT, -- Hardcover, Paperback, etc.
  publisher TEXT,
  publication_date DATE,
  page_count INTEGER,
  inventory_count INTEGER DEFAULT 0,
  reserved_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_stock', -- in_stock, low_stock, out_of_stock, preorder
  is_staff_pick BOOLEAN DEFAULT FALSE,
  staff_reviewer TEXT,
  staff_quote TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add inventory columns if books table already exists
ALTER TABLE books ADD COLUMN IF NOT EXISTS inventory_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS reserved_count INTEGER DEFAULT 0;

-- ============================================
-- INVENTORY RESERVATIONS TABLE
-- ============================================
-- Tracks temporary reservations when items are in cart

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  book_id TEXT REFERENCES books(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  session_id TEXT NOT NULL,
  customer_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_book_id ON inventory_reservations(book_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_session_id ON inventory_reservations(session_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expires_at ON inventory_reservations(expires_at);

-- ============================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================

-- Books table - public read, admin write
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view books" ON books FOR SELECT USING (true);
CREATE POLICY "Service role can manage books" ON books FOR ALL USING (auth.role() = 'service_role');

-- Inventory reservations - public access (needed for cart)
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create reservations" ON inventory_reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view reservations" ON inventory_reservations FOR SELECT USING (true);
CREATE POLICY "Anyone can delete own reservations" ON inventory_reservations FOR DELETE USING (true);

-- ============================================
-- FUNCTION: Auto-cleanup expired reservations
-- ============================================
-- Creates a function that can be called to clean up old reservations

CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired reservations and return count
  WITH deleted AS (
    DELETE FROM inventory_reservations
    WHERE expires_at < NOW()
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SAMPLE BOOK DATA (Optional)
-- ============================================
-- Uncomment to add some test books with inventory

/*
INSERT INTO books (id, isbn, title, author, price, inventory_count, category, status) VALUES
('1', '9780143127741', 'The Midnight Library', 'Matt Haig', 26.00, 15, 'Fiction', 'in_stock'),
('2', '9780399590504', 'Educated', 'Tara Westover', 28.00, 8, 'Nonfiction', 'in_stock'),
('3', '9780062457714', 'The Subtle Art of Not Giving a F*ck', 'Mark Manson', 26.00, 12, 'Nonfiction', 'in_stock'),
('4', '9780735211292', 'Atomic Habits', 'James Clear', 27.00, 20, 'Nonfiction', 'in_stock'),
('5', '9780593135204', 'Project Hail Mary', 'Andy Weir', 28.99, 6, 'Fiction', 'in_stock')
ON CONFLICT (id) DO NOTHING;
*/
