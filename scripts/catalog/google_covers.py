#!/usr/bin/env python3
"""Fill in missing covers from Google Books, newest books first.

  python3 scripts/catalog/google_covers.py --since 2021 [--limit 10] [--dry-run]
  python3 scripts/catalog/google_covers.py --unknown-year [--limit ...]

Only books that still have no cover_url and a real ISBN are touched, so it
can stop and resume. Each cover is stored in the book-covers bucket (like
scripts/backfill-book-covers.mjs) and cover_url pointed at it.

Needs GOOGLE_BOOKS_API_KEY and SUPABASE_SECRET_KEY in .env.local. The key is
restricted to our website, so requests carry the site as their referer.
Google allows ~1,000 lookups a day and 100 a minute; the site itself uses
~40-80 a day, so a run stops cleanly when the daily quota is reached.
"""
import argparse, hashlib, json, re, struct, sys, time, urllib.error, urllib.parse, urllib.request
from catalog import CACHE, CTX, SUPABASE_URL, UA, _env_local, all_books, http, isbn_of, secret_key, write_headers

PLACEHOLDER_MD5 = 'a64fa89d'  # Google's "image not available" (575x750, 9,103 bytes)
REFERER = 'https://www.camarillobookworm.com/'


def fetch(url, headers=None):
    req = urllib.request.Request(url, headers={'User-Agent': UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
        return r.read()


def google_links(key, isbn):
    q = urllib.parse.urlencode({'q': f'isbn:{isbn}', 'key': key, 'fields': 'items(volumeInfo(imageLinks))'})
    d = json.loads(fetch(f'https://www.googleapis.com/books/v1/volumes?{q}', {'Referer': REFERER}))
    return ((d.get('items') or [{}])[0].get('volumeInfo') or {}).get('imageLinks') or {}


def best_image(links):
    """The largest real cover: Google's big sizes are sometimes its placeholder
    or a near-empty image, so fall back to the 128px thumbnail, always real."""
    base = (links.get('thumbnail') or links.get('smallThumbnail') or '').replace('http://', 'https://').replace('&edge=curl', '')
    if not base:
        return None
    for zoom, min_bytes in (('0', 15000), ('3', 15000), ('1', 2000)):
        try:
            b = fetch(re.sub(r'zoom=\d', f'zoom={zoom}', base) if 'zoom=' in base else base)
        except Exception:
            continue
        if len(b) >= min_bytes and hashlib.md5(b).hexdigest()[:8] != PLACEHOLDER_MD5:
            return b
    return None


def content_type(b):
    return 'image/png' if b[:8] == b'\x89PNG\r\n\x1a\n' else 'image/jpeg'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--since', type=int, help='only books first published in or after this year')
    ap.add_argument('--unknown-year', action='store_true', help='only books with no known publication year')
    ap.add_argument('--limit', type=int, default=10**6)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    gkey, skey = _env_local('GOOGLE_BOOKS_API_KEY'), secret_key()
    if not gkey:
        sys.exit('Add GOOGLE_BOOKS_API_KEY to .env.local')

    ol = json.loads((CACHE / 'openlibrary.json').read_text()) if (CACHE / 'openlibrary.json').exists() else {}
    def year(r):
        if r.get('publication_date'):
            return int(r['publication_date'][:4])
        ys = [d.get('first_publish_year') for d in ol.get(isbn_of(r) or '', []) if d.get('first_publish_year')]
        return min(ys) if ys else None
    todo = []
    for r in all_books('id,isbn,title,category,cover_url,publication_date', skey):
        if r.get('cover_url') or not isbn_of(r) or r.get('category') == 'Gifts':
            continue
        y = year(r)
        if (args.unknown_year and y is None) or (args.since and y is not None and y >= args.since):
            # Newest first, by full date where we have one, in case the quota runs out.
            when = r.get('publication_date') or (f'{y}-00-00' if y else '')
            todo.append((when, r))
    todo = [r for _, r in sorted(todo, key=lambda t: t[0], reverse=True)][:args.limit]
    print(f'{len(todo)} books to look up{" (dry run)" if args.dry_run else ""}')

    found = stored = 0
    for n, r in enumerate(todo, 1):
        isbn = isbn_of(r)
        try:
            links = google_links(gkey, isbn)
        except urllib.error.HTTPError as e:
            if e.code == 429 and b'per day' in e.read():
                print(f'Google daily quota reached after {n - 1}; run again tomorrow to continue')
                break
            time.sleep(10)
            continue
        image = best_image(links) if links else None
        time.sleep(0.7)  # under 100 lookups a minute
        if not image:
            continue
        found += 1
        if args.dry_run:
            print(f"  would store {isbn} {r['title'][:50]} ({len(image)} bytes)")
            continue
        req = urllib.request.Request(f'{SUPABASE_URL}/storage/v1/object/book-covers/{isbn}.jpg', data=image, method='POST',
                                     headers={'apikey': skey, 'Authorization': f'Bearer {skey}', 'Content-Type': content_type(image),
                                              'x-upsert': 'true', 'User-Agent': UA})
        urllib.request.urlopen(req, timeout=30, context=CTX).read()
        url = f'{SUPABASE_URL}/storage/v1/object/public/book-covers/{isbn}.jpg'
        http(f"{SUPABASE_URL}/rest/v1/books?id=eq.{urllib.parse.quote(r['id'])}", data=json.dumps({'cover_url': url}).encode(),
             headers=write_headers(skey), method='PATCH')
        stored += 1
        if stored % 50 == 0:
            print(f'  {n}/{len(todo)} looked up, {stored} covers stored')
    print(f'done: {found} covers found, {stored} stored')


if __name__ == '__main__':
    main()
