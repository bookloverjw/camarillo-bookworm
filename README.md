# The Bookworm

The website for The Bookworm, an independent bookshop in Camarillo, California,
open since 1973. A Vite + React front end, a Supabase database behind it, and a
set of scripts that keep the catalogue honest.

The shop is **The Bookworm** on its sign, and that is what the header, footer
and any new copy should say. Page titles and meta descriptions keep "Camarillo
Bookworm" so the search engines can tell it from every other bookshop of that
name, and the JSON-LD carries both.

## What you need

| | |
|---|---|
| Node | 22 (this was built on 22.18) |
| Python | 3.11 or newer, for `scripts/catalog/` and `scripts/collections/` |
| psql | only to run the files in `supabase/` |

```bash
npm install
brew install libpq && brew link --force libpq      # psql, for the SQL files
```

Playwright needs its browsers once: `npx playwright install chromium`.

## Keys

The Supabase URL and the publishable key are checked in, in
`src/lib/supabase.ts`. They are meant to be public: the `books` table grants
that key a named list of customer-facing columns and nothing else, which is
why a `select=*` against it is refused. See
`supabase/books-public-columns-2-lockdown.sql`.

Everything else goes in `.env.local`, which is gitignored and lives in the
main checkout. A git worktree has no copy of its own, and the scripts look
back at the main checkout for it.

| variable | what needs it | where it comes from |
|---|---|---|
| `SUPABASE_SECRET_KEY` | every script that writes | Supabase dashboard > Project Settings > API keys > secret |
| `DATABASE_URL` | `scripts/db` | Project Settings > Database > Connection string > URI, with the password |
| `ISBNDB_API_KEY` | list prices, Coming Soon | isbndb.com > account |
| `GOOGLE_BOOKS_API_KEY` | the nightly covers job | Google Cloud console |

The serverless functions under `api/` read their own secrets from Vercel, not
from here: `RESEND_API_KEY`, `NYT_API_KEY`, `CONTACT_TO`, `CONTACT_FROM`,
`NEWSLETTER_REPLY_TO` and the `APPLE_PASS_*` set for wallet passes. The three
GitHub Actions workflows need `SUPABASE_SECRET_KEY`, `ISBNDB_API_KEY` and
`GOOGLE_BOOKS_API_KEY` as repository secrets.

## Running it

```bash
npm run dev          # vite, on http://localhost:5173
npm run build        # snapshot Coming Soon, vite build, prerender <head>
npm run preview      # serve the build
npm test             # playwright
```

Run `npm run build` before committing anything under `src/`.

## The database

`supabase/` holds plain SQL, each file safe to re-run. Apply one with

```bash
scripts/db supabase/author-search.sql
```

or paste it into the dashboard's SQL editor, which is what the headers say and
what most of them were run through.

Order matters in two places. `books-public-columns-1-prepare.sql` has to be
live, and the site build that names its columns deployed, before
`books-public-columns-2-lockdown.sql` takes the blanket `SELECT` away - running
the second one early broke catalogue reads once. And `author-search.sql`
installs `pg_trgm`, `unaccent` and the `f_unaccent` wrapper that
`book-contributors.sql` then builds on.

A column added to `books` later is invisible to the publishable key until it is
added to the allow-list in the lockdown file, which is the right way round.

## The catalogue scripts

`scripts/catalog/` cleans up what the point-of-sale exports. They all work the
same way: run one with no arguments and it writes a CSV to
`scripts/catalog/.cache/` and touches nothing; you read it, change your mind in
the spreadsheet, and run it again with `--apply`. Every one of them saves the
previous values first and takes `--undo`.

| | |
|---|---|
| `fetch_openlibrary.py` | download Open Library's record for every ISBN, into `.cache/`. Most of the others read it |
| `propose_fixes.py` / `apply_fixes.py` | scrambled authors, cut-off titles, books on the wrong side of fiction |
| `merge_authors.py` | one spelling per author: "Sarah J Maas" into "Sarah J. Maas" |
| `recover_authors.py` | a person's name where the publisher's was, "Golden Books" into "Beatrix Potter" |
| `set_contributors.py` | who illustrated it and who translated it |
| `set_author_last.py` | the surname the site sorts by |
| `import_collection_books.py` | add books the collections feature names but the shop does not carry |
| `google_covers.py`, `move_gifts.py` | covers, and merchandise out of the book categories |

`author_names.py` holds the rules for when two spellings are one person, and
both `merge_authors.py` and the importer use it, so an import cannot undo a
merge. Hand-checked decisions live in `manual_fixes.json` and are never
overwritten.

Spreadsheets round a 13-digit ISBN into `9.78031E+12`. The scripts fall back to
matching on the title when that happens, and say so, but it is worth keeping
that column as text.

## Scheduled work

Three GitHub Actions workflows, all also runnable by hand:
`collections-refresh.yml`, `covers-refresh.yml` and `isbndb-refresh.yml`.
Nightly database jobs are set up by `supabase/schedule-jobs.sql` with pg_cron.

## Deploying

Vercel, configured by `vercel.json`. The functions under `api/` deploy with it.
