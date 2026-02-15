-- Add total_sold column for bestseller sorting
-- This column is populated from BookMagic POS sync data.
-- Run in Supabase SQL Editor.

ALTER TABLE books ADD COLUMN IF NOT EXISTS total_sold INTEGER DEFAULT 0;

-- Index for efficient bestseller queries
CREATE INDEX IF NOT EXISTS idx_books_total_sold ON books(total_sold DESC);
