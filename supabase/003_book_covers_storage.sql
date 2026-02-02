-- ============================================
-- Book Covers Storage Bucket
-- Run this in Supabase SQL Editor
-- ============================================

-- Create storage bucket for book covers
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'book-covers',
  'book-covers',
  true,  -- Public bucket for serving images
  5242880,  -- 5MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to book covers
CREATE POLICY "Public can view book covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'book-covers');

-- Allow service role to upload/update/delete covers
CREATE POLICY "Service role can manage book covers"
ON storage.objects FOR ALL
USING (bucket_id = 'book-covers' AND auth.role() = 'service_role');

-- Note: Book covers will be stored with the pattern:
-- book-covers/{book_id}.jpg (or .png, .webp)
--
-- The public URL will be:
-- https://lildbdxabljkoynvpflu.supabase.co/storage/v1/object/public/book-covers/{book_id}.jpg
