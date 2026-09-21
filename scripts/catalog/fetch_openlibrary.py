#!/usr/bin/env python3
"""Download Open Library's record for every catalogue ISBN (title, authors,
subjects, publisher, pages) into .cache/openlibrary.json. Re-runnable: ISBNs
already fetched are skipped. About 10 minutes for the whole catalogue.

  python3 scripts/catalog/fetch_openlibrary.py
"""
import json, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from catalog import CACHE, all_books, http, isbn_of

OUT = CACHE / 'openlibrary.json'
FIELDS = 'key,title,subtitle,author_name,subject,isbn,publisher,number_of_pages_median,first_publish_year,language'


def batch(isbns):
    q = urllib.parse.urlencode({'q': 'isbn:(' + ' OR '.join(isbns) + ')', 'fields': FIELDS, 'limit': 200})
    try:
        docs = http(f'https://openlibrary.org/search.json?{q}')['docs']
    except Exception as e:
        print(f'  batch failed ({e}); will retry next run')
        return None
    out = {i: [] for i in isbns}
    wanted = set(isbns)
    for d in docs:
        for i in set(d.get('isbn', [])) & wanted:
            out[i].append({k: d.get(k) for k in ('key', 'title', 'subtitle', 'author_name', 'subject', 'publisher',
                                                  'number_of_pages_median', 'first_publish_year', 'language')})
    return out


def main():
    cache = json.loads(OUT.read_text()) if OUT.exists() else {}
    isbns = sorted({i for r in all_books('id,isbn') if (i := isbn_of(r))} - set(cache))
    print(f'{len(cache)} cached; fetching {len(isbns)}')
    chunks = [isbns[i:i + 50] for i in range(0, len(isbns), 50)]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for n, res in enumerate(pool.map(batch, chunks), 1):
            if res:
                cache.update(res)
            if n % 20 == 0 or n == len(chunks):
                OUT.write_text(json.dumps(cache))
                print(f'  {n}/{len(chunks)} batches; {sum(1 for v in cache.values() if v)} found')
    OUT.write_text(json.dumps(cache))


if __name__ == '__main__':
    main()
