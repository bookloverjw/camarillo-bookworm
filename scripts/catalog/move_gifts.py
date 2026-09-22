#!/usr/bin/env python3
"""Move merchandise (bookmarks, T-shirts, journals, puzzles, games) out of the
book categories into 'Gifts', so it stops showing up on the Fiction shelf.

  python3 scripts/catalog/move_gifts.py            # list what would move
  python3 scripts/catalog/move_gifts.py --apply    # move it (saves an undo file)
"""
import json, re, sys, time, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from catalog import CACHE, SUPABASE_URL, all_books, http, isbn_of, secret_key, write_headers

GIFT_GENRES = {'Office', 'Games/Puzzles', 'GAM', 'MRCH', 'GFTS', 'VID'}
BRANDS = re.compile(r'^(out of print|galison|mudpuppy|penguin|melissa (&|and) doug|ravensburger)$', re.I)
# Words that only ever describe merchandise.
STRONG = re.compile(r'bookmark|t-shirt.*\b(small|medium|large|x+l|size|unisex)\b|ringer|\btee\b|tote bag|\bmug\b|jigsaw|\d+[- ]?(piece|pc)\b|sticker (pad|play set|book set)|'
                    r'playing cards|\bplush\b|keychain|enamel pin|greeting card|\bcard\b.*(birthday|baby|thank|get well)|'
                    r'notebook \((a5|lined|dot|blank)|vegan leather|\bjournal\b.*\b(lined|dot|vegan|leather|blank)\b', re.I)
# Words that usually do, unless the item is a real book (The Notebook, Beverly Cleary's Socks).
WEAK = re.compile(r'\bsocks\b|sticker|notebook|\bmagnet|candle|puzzle|\bgame\b', re.I)

OL = json.loads((CACHE / 'openlibrary.json').read_text()) if (CACHE / 'openlibrary.json').exists() else {}


def is_book(r):
    """Listed on Open Library as a book: merchandise almost never is."""
    return bool(OL.get(isbn_of(r) or ''))


def is_gift(r):
    title = r.get('title') or ''
    if STRONG.search(title):
        return True
    signals = ((r.get('genre') or '') in GIFT_GENRES or BRANDS.match((r.get('author') or '').strip())
               or WEAK.search(title))
    return bool(signals) and not is_book(r)


def main():
    key = secret_key()
    rows = [r for r in all_books('id,isbn,title,author,category,genre', key) if r['category'] != 'Gifts' and is_gift(r)]
    by_cat = {}
    for r in rows:
        by_cat.setdefault(r['category'], []).append(r)
    print(f'{len(rows)} items to move to Gifts:')
    for cat, rs in sorted(by_cat.items(), key=lambda kv: -len(kv[1])):
        print(f"  from {cat}: {len(rs)}  e.g. {'; '.join(r['title'][:34] for r in rs[:4])}")
    if '--apply' not in sys.argv:
        return
    undo = CACHE / f"undo-gifts-{time.strftime('%Y%m%d-%H%M%S')}.json"
    undo.write_text(json.dumps([{'id': r['id'], 'old': {'category': r['category']}} for r in rows]))
    def one(r):
        http(f"{SUPABASE_URL}/rest/v1/books?id=eq.{urllib.parse.quote(r['id'])}",
             data=json.dumps({'category': 'Gifts'}).encode(), headers=write_headers(key), method='PATCH')
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(one, rows))
    print(f'moved {len(rows)}; undo with: python3 scripts/catalog/apply_fixes.py --undo {undo}')


if __name__ == '__main__':
    main()
