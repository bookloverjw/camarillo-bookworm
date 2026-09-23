#!/usr/bin/env python3
"""Add the books our collections feature but the catalogue doesn't have, so
each gets a full book page, shows up in search, and can be recommended.

  python3 scripts/catalog/import_collection_books.py            # build .cache/import.json and review CSV
  SUPABASE_SECRET_KEY=... python3 scripts/catalog/import_collection_books.py --apply

Details come from Open Library (title, author, description, publisher,
pages, subjects for the category). New records are marked with the tag
'web-catalogue' and zero inventory, so staff and the POS sync can tell them
apart from stock; the price is left at 0 (the site hides it) until the
ISBNdb price job fills in the list price. Existing records are never
overwritten.

Authors are filed under the spelling the catalogue already uses, so an
import can't undo merge_authors.py's work by adding a second "Sarah J Maas"
next to "Sarah J. Maas".
"""
import argparse, csv, json, re, urllib.parse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from author_names import canonical_author, merge_lookup
from catalog import CACHE, ROOT, SUPABASE_URL, all_books, http, isbn_of, secret_key, write_headers

COLLECTIONS = ROOT / 'public' / 'collections'
TAG = 'web-catalogue'
# What an award's books are, when Open Library's subjects don't say.
AWARD_CATEGORY = {'caldecott': 'Picture Books', 'belpre-illustrator': 'Picture Books', 'newbery': 'Kids',
                  'belpre-childrens-author': 'Kids', 'belpre-author': 'Kids', 'printz': 'YA', 'belpre-ya-author': 'YA',
                  'nba-young-people': 'YA', 'eisner-graphic-album': 'Graphic Novels', 'eisner-graphic-memoir': 'Graphic Novels',
                  'hugo-novel': 'Sci-Fi', 'edgar-novel': 'Mystery', 'stoker-novel': 'Fiction', 'nba-nonfiction': 'Nonfiction',
                  'pulitzer-nonfiction': 'Nonfiction'}


# Hand-checked categories where Open Library's subjects mislead (Sept 2026).
CATEGORY_OVERRIDES = {'You Only Live Twice': 'Fiction', 'Notorious RBG': 'Biography',
                      'A Bad Boy Can Be Good For a Girl': 'YA'}


def wanted():
    """Every uncarried collection book with an ISBN: isbn -> {title, author, hint}."""
    out = {}
    for path in sorted(COLLECTIONS.glob('*.json')):
        data = json.loads(path.read_text())
        if path.name == 'awards.json':
            items = [(r['book'], AWARD_CATEGORY.get(r['award'])) for r in data['results']]
        else:
            items = [(b, None) for s in data.get('sections', []) for b in s['books']]
        for b, hint in items:
            i = (b.get('isbn') or '').lstrip(':')
            if b.get('catalogId') or not re.fullmatch(r'97[89]\d{10}', i):
                continue
            out.setdefault(i, {'title': b['title'], 'author': re.sub(r'\s*\(illustrator\)', '', b['author']),
                               'cover': b.get('cover'), 'hint': hint, 'collections': set()})
            out[i]['collections'].add(data.get('title', 'Award winners'))
    return out


BAD_EDITION = re.compile(r'large print|turtleback|thorndike|wheeler|howes|recorded books|audio|braille|library binding|graded|readers|oxford university press|perfection learning', re.I)


def open_library(item):
    """The book's Open Library work (found by title and author, so a stray
    edition's ISBN can't lead us astray) and its best edition: a US paperback
    or hardcover in English, not large print, a library binding or a reader."""
    isbn, w = item
    q = urllib.parse.urlencode({'title': w['title'].split(':')[0], 'author': re.split(r',| and ', w['author'])[0],
                                'fields': 'key,title,subtitle,author_name,subject,edition_count', 'limit': 5})
    try:
        docs = http(f'https://openlibrary.org/search.json?{q}')['docs']
    except Exception:
        docs = []
    if not docs:
        return isbn, {}
    work = max(docs, key=lambda d: d.get('edition_count') or 0)
    out = {**work}
    try:
        w_json = http(f"https://openlibrary.org{work['key']}.json")
        desc = w_json.get('description')
        out['description'] = desc.get('value') if isinstance(desc, dict) else desc
        eds = http(f"https://openlibrary.org{work['key']}/editions.json?limit=100").get('entries', [])
    except Exception:
        return isbn, out
    def score(e):
        pubs = ' '.join(e.get('publishers') or [])
        fmt = (e.get('physical_format') or '').lower()
        return ((e.get('publish_country') or '').endswith('u') * 3 + (fmt in ('paperback', 'hardcover', 'trade paperback')) * 2
                - bool(BAD_EDITION.search(pubs + ' ' + fmt + ' ' + (e.get('edition_name') or ''))) * 10
                + ('eng' in json.dumps(e.get('languages') or [{'key': '/languages/eng'}])) * 1)
    best = None
    for e in sorted(eds, key=score, reverse=True):
        i13 = next((i for i in e.get('isbn_13') or [] if re.fullmatch(r'(97[89][01]|9798)\d{9}', i)), None)
        if i13 and score(e) >= 3:
            best = e
            out.update({'isbn': i13, 'publisher': (e.get('publishers') or [None])[0], 'pages': e.get('number_of_pages')})
            break
    return isbn, out


def category(subjects, hint):
    text = ' | '.join(subjects or [])
    if re.search(r'picture books|stories in rhyme|board books', text, re.I): return 'Picture Books'
    if re.search(r'graphic novels|comic books, strips', text, re.I): return 'Graphic Novels'
    if re.search(r'young adult', text, re.I): return 'YA'
    if re.search(r'juvenile', text, re.I): return hint if hint in ('Picture Books', 'YA') else 'Kids'
    if hint: return hint
    fiction = re.search(r'\bfiction\b|\bnovel|nyt:.*(?<!non)fiction', text, re.I)
    if fiction:
        for cat, rx in [('Fantasy', r'fantasy'), ('Sci-Fi', r'science fiction'), ('Mystery', r'mystery|detective'),
                        ('Thriller', r'thriller|suspense'), ('Romance', r'romance|love stories')]:
            if re.search(rx, text, re.I): return cat
        return 'Fiction'
    for cat, rx in [('Biography', r'biograph|memoir'), ('Cooking', r'cook|recipes'), ('History', r'\bhistory\b'),
                    ('Science', r'\bscience'), ('Self-Help', r'self-help|conduct of life'), ('Religion', r'religio|christian')]:
        if re.search(rx, text, re.I): return cat
    return 'Nonfiction' if subjects else 'Fiction'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    out = CACHE / 'import.json'

    if args.apply:
        key = secret_key()
        rows = json.loads(out.read_text())
        existing = {r['id'] for r in all_books('id')} | {(r.get('isbn') or '').lstrip(':') for r in all_books('isbn')}
        rows = [r for r in rows if r['id'] not in existing]
        print(f'adding {len(rows)} books')
        for i in range(0, len(rows), 100):
            http(f'{SUPABASE_URL}/rest/v1/books', data=json.dumps(rows[i:i + 100]).encode(),
                 headers={**write_headers(key), 'Prefer': 'resolution=ignore-duplicates,return=minimal'}, method='POST')
            print(f'  {min(i + 100, len(rows))}/{len(rows)}')
        print('done')
        return

    want = wanted()
    catalogue = all_books('id,isbn,author')
    have = {(r.get('isbn') or '').lstrip(':') for r in catalogue}
    want = {i: w for i, w in want.items() if i not in have}
    known = Counter(r['author'].strip() for r in catalogue if (r.get('author') or '').strip())
    merges = merge_lookup()
    print(f'{len(want)} collection books to add; looking them up on Open Library')
    with ThreadPoolExecutor(max_workers=4) as pool:
        found = dict(pool.map(open_library, want.items()))
    rows, review, seen = [], [], set(have)
    for isbn, w in sorted(want.items()):
        d = found.get(isbn) or {}
        best = d.get('isbn') or isbn
        if best in seen:
            continue  # we already carry that edition, or another collection book chose it
        seen.add(best)
        # Our collections' titles are curated and properly capitalised; Open Library's often aren't.
        title = w['title']
        if ':' not in title and d.get('subtitle') and len(d['subtitle']) < 80 and d['subtitle'][:1].isupper():
            title = f"{title}: {d['subtitle']}"
        # The spelling the catalogue already files this author under, so the
        # book joins their page instead of starting a second one.
        author = canonical_author(w['author'], known, merges)
        row = {
            'id': best, 'isbn': best, 'title': title, 'author': author,
            'description': (d.get('description') or None) and d['description'].strip()[:4000],
            'price': 0, 'cover_url': w.get('cover') if best == isbn else None,
            'category': CATEGORY_OVERRIDES.get(w['title']) or category(d.get('subject'), w['hint']), 'publisher': d.get('publisher'),
            'page_count': d.get('pages'), 'inventory_count': 0, 'reserved_count': 0,
            'status': 'out_of_stock', 'tags': [TAG],
        }
        rows.append(row)
        review.append([best, isbn if best != isbn else '', row['title'], row['author'], row['category'], row['publisher'] or '',
                       bool(row['description']), '; '.join(sorted(w['collections']))])
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=0))
    with open(CACHE / 'import-review.csv', 'w', newline='') as f:
        wr = csv.writer(f)
        wr.writerow(['isbn', 'replaces collection isbn', 'title', 'author', 'category', 'publisher', 'has description', 'collections'])
        wr.writerows(review)
    print(f"{len(rows)} ready; {sum(1 for r in rows if r['description'])} with descriptions; categories {Counter(r['category'] for r in rows).most_common()}")
    print(f'review: {CACHE / "import-review.csv"}')


if __name__ == '__main__':
    main()
