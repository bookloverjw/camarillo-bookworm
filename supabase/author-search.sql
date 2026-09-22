-- ============================================================
-- The Bookworm - fuzzy author search for "Authors you follow"
-- ============================================================
-- Finds authors in the catalogue by an approximate name: accents ignored
-- ("marquez" finds Gabriel García Márquez), small misspellings tolerated
-- ("Louise Erdich"). Read-only, returns only names and how many of their
-- books we list. SECURITY DEFINER because the books table's public grants
-- are column-limited. Run in the Supabase SQL editor; safe to re-run.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() isn't marked immutable, which an index needs
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
SET search_path = public
AS $$ SELECT lower(public.unaccent($1)) $$;

CREATE INDEX IF NOT EXISTS idx_books_author_trgm
  ON public.books USING gin (public.f_unaccent(author) gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_authors(q text, max_rows int DEFAULT 8)
RETURNS TABLE (author text, book_count bigint, score real)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH needle AS (SELECT public.f_unaccent(btrim(q)) AS n)
  SELECT
    b.author,
    count(*)                                                       AS book_count,
    greatest(
      similarity(public.f_unaccent(b.author), needle.n),
      -- a good partial match ("erdrich" inside "louise erdrich") scores high
      CASE WHEN public.f_unaccent(b.author) LIKE '%' || needle.n || '%' THEN 0.9 ELSE 0 END
    )::real                                                        AS score
  FROM public.books b, needle
  WHERE length(needle.n) >= 2
    AND b.author IS NOT NULL AND b.author <> ''
    AND (public.f_unaccent(b.author) % needle.n
         OR public.f_unaccent(b.author) LIKE '%' || needle.n || '%')
  GROUP BY b.author, needle.n
  ORDER BY score DESC, book_count DESC, b.author
  LIMIT least(greatest(max_rows, 1), 25);
$$;

REVOKE ALL ON FUNCTION public.search_authors(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_authors(text, int) TO anon, authenticated;
