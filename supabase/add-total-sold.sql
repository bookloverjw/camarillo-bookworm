-- Add total_sold and tags columns
-- Run in Supabase SQL Editor.

-- Bestseller sorting: populated from BookMagic POS sync data
ALTER TABLE books ADD COLUMN IF NOT EXISTS total_sold INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_books_total_sold ON books(total_sold DESC);

-- Topic tags for curated browsing (e.g. Kids topics: dinosaurs, princesses, etc.)
ALTER TABLE books ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_books_tags ON books USING GIN(tags);
