#!/usr/bin/env python3
"""Fill in author_last (the surname the site sorts by, and which it needs
before it shows an author at all) for imported books and for fixed authors
whose old surname no longer fits the name.

  python3 scripts/catalog/set_author_last.py [--dry-run]
"""
import json, sys, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from author_names import surname
from catalog import CACHE, SUPABASE_URL, all_books, fold, http, secret_key, write_headers

rows = all_books('id,author,author_last,tags')
fixed = {f['id'] for f in json.loads((CACHE / 'fixes.json').read_text()) if 'author' in f['new']}
changes = []
for r in rows:
    want = surname(r['author'])
    if not want or r.get('author_last') == want:
        continue
    imported = 'web-catalogue' in (r.get('tags') or [])
    have = fold(r.get('author_last') or '').split()
    stale = r['id'] in fixed and (not have or not all(w in fold(r['author']).split() for w in have))
    if imported or stale:
        changes.append((r['id'], want, r.get('author_last')))
print(f"{len(changes)} books: e.g. {changes[:6]}")
if '--dry-run' in sys.argv:
    sys.exit()
key = secret_key()
def one(c):
    http(f"{SUPABASE_URL}/rest/v1/books?id=eq.{urllib.parse.quote(c[0])}", data=json.dumps({'author_last': c[1]}).encode(),
         headers=write_headers(key), method='PATCH')
with ThreadPoolExecutor(max_workers=6) as pool:
    list(pool.map(one, changes))
print('done')
