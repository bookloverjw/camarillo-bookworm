-- ============================================================
-- The Bookworm - illustrators and translators
-- ============================================================
-- "The Odyssey by Homer, translated by Emily Wilson" and "The Day the
-- Crayons Quit by Drew Daywalt, illustrated by Oliver Jeffers" are two
-- names each, and until now the catalogue carried one of them. This adds
-- the second, so a reader can search for the illustrator they love and
-- filter a shelf down to them.
--
-- books.contributors holds [{"name": "...", "role": "illustrator"}, ...].
-- A jsonb array rather than a table because it is read with the book and
-- never on its own, and rather than more text columns because a book can
-- have two translators and an anthology several illustrators.
--
-- scripts/catalog/set_contributors.py fills it. Run this first.
-- Safe to re-run.
-- ============================================================

BEGIN;

ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS contributors jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Refuse anything that isn't a list of {name, role}, so a bad import can't
-- put a string where the site expects an object. A CHECK cannot contain a
-- subquery, so the per-entry test lives in a function it can call.
CREATE OR REPLACE FUNCTION public.contributors_ok(v jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT jsonb_typeof(v) = 'array' AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v) AS c
    WHERE jsonb_typeof(c) <> 'object'
       OR jsonb_typeof(c -> 'name') <> 'string'
       OR c ->> 'role' NOT IN ('illustrator', 'translator', 'editor', 'photographer', 'colorist')
  )
$$;

ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_contributors_shape;
ALTER TABLE public.books ADD CONSTRAINT books_contributors_shape
  CHECK (public.contributors_ok(contributors)) NOT VALID;
ALTER TABLE public.books VALIDATE CONSTRAINT books_contributors_shape;

-- Filtering "show me everything Oliver Jeffers drew".
CREATE INDEX IF NOT EXISTS idx_books_contributors ON public.books USING gin (contributors jsonb_path_ops);

-- No trigram index here: search_contributors unnests the array first, so an
-- index over the whole jsonb text could not answer it. It scans the 650-odd
-- books that have contributors, which is nothing.

-- The publishable key may read it: it is on the cover.
-- (books-public-columns-2-lockdown.sql grants an allow-list; add
-- 'contributors' to the array there as well, or this grant is lost the next
-- time that file is run.)
GRANT SELECT (contributors) ON public.books TO anon, authenticated;

-- ------------------------------------------------------------
-- search_contributors(q) - the same shape as search_authors(q),
-- so the follow/suggest UI can call either.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_contributors(q text, max_rows int DEFAULT 8)
RETURNS TABLE (name text, role text, book_count bigint, score real)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH needle AS (SELECT public.f_unaccent(btrim(q)) AS n),
  people AS (
    SELECT c ->> 'name' AS name, c ->> 'role' AS role
    FROM public.books b, jsonb_array_elements(b.contributors) AS c
    WHERE b.contributors <> '[]'::jsonb
  )
  SELECT
    people.name::text,
    people.role::text,
    count(*) AS book_count,
    greatest(
      similarity(public.f_unaccent(people.name), needle.n),
      CASE WHEN public.f_unaccent(people.name) LIKE '%' || needle.n || '%' THEN 0.9 ELSE 0 END
    )::real AS score
  FROM people, needle
  WHERE length(needle.n) >= 2
    AND (public.f_unaccent(people.name) % needle.n
         OR public.f_unaccent(people.name) LIKE '%' || needle.n || '%')
  GROUP BY people.name, people.role, needle.n
  ORDER BY score DESC, book_count DESC, people.name
  LIMIT least(greatest(max_rows, 1), 25);
$$;

REVOKE ALL ON FUNCTION public.search_contributors(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_contributors(text, int) TO anon, authenticated;

-- ------------------------------------------------------------
-- books_by_contributor(name) - every book someone worked on, for the
-- shelf page. SECURITY DEFINER for the same reason search_authors is:
-- the books table's public grants are column-limited.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.books_by_contributor(who text, max_rows int DEFAULT 60)
RETURNS TABLE (id text, title text, author text, cover_url text, role text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Cast every column: this database has varchar where the migrations say
  -- text in places, and a SQL function's RETURNS TABLE will not tolerate it.
  SELECT b.id::text, b.title::text, b.author::text, b.cover_url::text, (c ->> 'role')::text
  FROM public.books b, jsonb_array_elements(b.contributors) AS c
  WHERE public.f_unaccent(c ->> 'name') = public.f_unaccent(btrim(who))
  ORDER BY b.title
  LIMIT least(greatest(max_rows, 1), 200);
$$;

REVOKE ALL ON FUNCTION public.books_by_contributor(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.books_by_contributor(text, int) TO anon, authenticated;

COMMIT;
