#!/usr/bin/env python3
"""Add every book the website shows but the catalogue doesn't hold, so each
gets a book page, shows up in search and the sitemap, and can be wishlisted,
followed by author and recommended.

Where the website's books come from, and which of them this script imports:

  * the NYT best seller lists and New Releases (/api/homepage-books)
  * Coming Soon (/coming-soon.json and /api/coming-soon), forthcoming titles
  * the collections: book club picks, award winners, staff collections
    (public/collections/*.json)

Anything one of those already links to the catalogue is skipped.

  python3 scripts/catalog/import_collection_books.py            # build .cache/import.json and the review CSV
  SUPABASE_SECRET_KEY=... python3 scripts/catalog/import_collection_books.py --apply

Details come from the source that knows best: the NYT's own one-line
description, ISBNdb's release date for a forthcoming book, our collections'
curated titles - and Open Library for publisher, page count and the subjects
behind the category. Author names are resolved to the catalogue's existing
spelling (authors.py) so an import never creates a second Gabriel García
Márquez.

New records are marked with the tag 'web-catalogue' and zero inventory, so
staff and the POS sync can tell them apart from stock; the price is left at 0
(the site hides it) until the ISBNdb price job fills in the list price. A book
not yet published goes in with status 'preorder' and its publication date, so
the site offers it as a preorder; everything else is 'out_of_stock', which the
site shows as "Available to Order". Existing records are never overwritten.
"""
import argparse, csv, json, re, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from authors import Authors, key
from catalog import CACHE, ROOT, SUPABASE_URL, all_books, fold, http, secret_key, write_headers

COLLECTIONS = ROOT / 'public' / 'collections'
SITE = 'https://www.camarillobookworm.com'
TAG = 'web-catalogue'
ISBN13 = re.compile(r'97[89]\d{10}')

# What an award's books are, when Open Library's subjects don't say.
AWARD_CATEGORY = {'caldecott': 'Picture Books', 'belpre-illustrator': 'Picture Books', 'newbery': 'Kids',
                  'belpre-childrens-author': 'Kids', 'belpre-author': 'Kids', 'printz': 'YA', 'belpre-ya-author': 'YA',
                  'nba-young-people': 'YA', 'eisner-graphic-album': 'Graphic Novels', 'eisner-graphic-memoir': 'Graphic Novels',
                  'hugo-novel': 'Sci-Fi', 'edgar-novel': 'Mystery', 'stoker-novel': 'Fiction', 'nba-nonfiction': 'Nonfiction',
                  'pulitzer-nonfiction': 'Nonfiction'}

# Which shelf an NYT list is really about; its own Fiction/Nonfiction is kept
# apart (NYT_CATEGORY) because it's too broad to beat Open Library's subjects.
NYT_SHELF = {'Picture Books': 'Picture Books', 'Middle Grade': 'Kids', 'Series': 'Kids',
             'Young Adult': 'YA', 'Graphic Novel': 'Graphic Novels'}

# Hand-checked categories where Open Library's subjects mislead (Sept 2026).
CATEGORY_OVERRIDES = {'You Only Live Twice': 'Fiction', 'Notorious RBG': 'Biography',
                      'A Bad Boy Can Be Good For a Girl': 'YA'}

# Fixes for books the sources get wrong, shared with propose_fixes.py.
MANUAL = {k: v for k, v in json.loads((Path(__file__).parent / 'manual_fixes.json').read_text()).items()
          if not k.startswith('_')}

# The catalogue holds "Bride", not ISBNdb's "Bride - Bride #1", "Fight or
# Flight (Diary of a Wimpy Kid #21) (Volume 21)", "Dangerous Impulses, Book 5 -
# cold cases get hot in the unputdownable...", or its doubled subtitles.
SERIES = re.compile(r',\s*(?:book|bk\.?|vol(?:ume)?\.?|no\.?|part)\s*\d+\s*$', re.I)


# A series charting as a whole, and the boxed sets the lists point at, aren't
# books: they get no catalogue row, and their card keeps the external quick view.
NOT_A_BOOK = re.compile(r'box(ed)? set|\bbooks \d+\s*[-–]\s*\d+|complete (series|collection)', re.I)


def tidy_title(t):
    """An ISBNdb title written the way the catalogue writes titles."""
    t = re.split(r'\s+-\s+', re.sub(r'\s+', ' ', t).strip())[0]
    t = SERIES.sub('', t)
    for _ in range(3):                                    # one suffix, or several
        t = re.sub(r'\s*\([^()]{1,60}\)\s*$', '', t).strip()
    parts, out = [p.strip() for p in t.split(': ')], []
    for p in parts:                                       # ": The Poetry of Plain, Air" twice over
        if not out or fold(p) != fold(out[-1]):
            out.append(p)
    return ': '.join(out).strip(' :,-') or t


def add(out, isbn, source, **fields):
    """Record what one source says about a book."""
    rec = out.setdefault(isbn, {'sources': set(), 'collections': set(), 'said': {}})
    rec['sources'].add(source)
    rec['said'].setdefault(source, {}).update({k: v for k, v in fields.items() if v})


def pick(rec, field, order):
    """The field from the first of those sources that has it."""
    for source in order:
        value = rec['said'].get(source, {}).get(field)
        if value:
            return value
    return None


def from_collections(out):
    """Books our collections feature: curated titles, an award's category hint."""
    for path in sorted(COLLECTIONS.glob('*.json')):
        data = json.loads(path.read_text())
        if path.name == 'awards.json':
            items = [(r['book'], AWARD_CATEGORY.get(r['award'])) for r in data['results']]
        else:
            items = [(b, None) for s in data.get('sections', []) for b in s['books']]
        for b, hint in items:
            isbn = (b.get('isbn') or '').lstrip(':')
            if b.get('catalogId') or not ISBN13.fullmatch(isbn):
                continue
            add(out, isbn, 'collections', title=b['title'], hint=hint, cover=b.get('cover'),
                author=re.sub(r'\s*\(illustrator\)', '', b['author']))
            out[isbn]['collections'].add(data.get('title', 'Award winners'))


def from_homepage(out):
    """The NYT best seller lists and New Releases, as the homepage shows them."""
    data = http(f'{SITE}/api/homepage-books')
    books = [b for shelf in (data.get('bestsellers') or {}).values() for b in shelf] + (data.get('newReleases') or [])
    for b in books:
        isbn = b.get('isbn') or ''
        if b.get('catalogId') or not ISBN13.fullmatch(isbn):
            continue
        # The NYT's Series list charts a whole series ("MAGIC TREE HOUSE") and
        # points at a boxed set; there's no one book to add.
        if b.get('list') == 'Series' or NOT_A_BOOK.search(b['title']):
            continue
        add(out, isbn, 'homepage', title=b['title'], author=b['author'], cover=b.get('cover'),
            description=b.get('description'), publication_date=b.get('releaseDate'),
            hint=NYT_SHELF.get(b.get('list')) or (b['category'] if b['category'] in ('Kids', 'YA') else None),
            nyt=b['category'] if b['category'] in ('Fiction', 'Nonfiction') else None)
    return len(books)


def from_coming_soon(out):
    """Forthcoming books: the published snapshot plus whatever the API says now."""
    books = []
    for url in (f'{SITE}/coming-soon.json', f'{SITE}/api/coming-soon'):
        try:
            books += http(url).get('books') or []
        except Exception as e:
            print(f'  {url}: {e}')
    for b in books:
        isbn = b.get('isbn') or ''
        if b.get('catalog_id') or not ISBN13.fullmatch(isbn) or NOT_A_BOOK.search(b['title']):
            continue
        add(out, isbn, 'coming-soon', title=tidy_title(b['title']), author=b['author'],
            cover=b.get('cover_url'), publication_date=b.get('publication_date'))
    return len(books)


def wanted():
    """Every book the site shows and we don't carry: isbn -> what we know."""
    out = {}
    from_collections(out)
    print(f'{len(out)} from the collections')
    n = from_homepage(out)
    print(f'{len(out)} after {n} best sellers and new releases')
    n = from_coming_soon(out)
    print(f'{len(out)} after {n} Coming Soon books')
    for isbn, rec in out.items():
        # Our collections' titles are curated; the NYT's are title-cased from
        # capitals; ISBNdb's carry series numbers. In that order, then.
        rec['title'] = pick(rec, 'title', ('collections', 'homepage', 'coming-soon'))
        rec['author'] = pick(rec, 'author', ('collections', 'homepage', 'coming-soon'))
        rec['cover'] = pick(rec, 'cover', ('homepage', 'coming-soon', 'collections'))
        rec['description'] = pick(rec, 'description', ('homepage',))
        rec['publication_date'] = pick(rec, 'publication_date', ('coming-soon', 'homepage'))
        rec['hint'] = pick(rec, 'hint', ('homepage', 'collections'))
        rec['nyt'] = pick(rec, 'nyt', ('homepage',))
        # Only a collection book may be imported as another edition: the NYT
        # and ISBNdb name the US edition the reader is being shown.
        rec['substitute'] = rec['sources'] == {'collections'}
    return out


BAD_EDITION = re.compile(r'large print|turtleback|thorndike|wheeler|howes|recorded books|audio|braille|library binding|graded|readers|oxford university press|perfection learning', re.I)


def work_details(key):
    """Subjects, description and subtitle from an Open Library work."""
    out = {}
    try:
        w = http(f'https://openlibrary.org{key}.json')
    except Exception:
        return out
    desc = w.get('description')
    out['description'] = desc.get('value') if isinstance(desc, dict) else desc
    out['subject'] = w.get('subjects')
    out['subtitle'] = w.get('subtitle')
    return {k: v for k, v in out.items() if v}


def by_isbn(isbn):
    """Publisher, pages and the work's subjects for an ISBN we must keep."""
    try:
        ed = http(f'https://openlibrary.org/isbn/{isbn}.json')
    except Exception:
        return {}
    out = {'publisher': (ed.get('publishers') or [None])[0], 'pages': ed.get('number_of_pages'),
           'subtitle': ed.get('subtitle')}
    key = ((ed.get('works') or [{}])[0] or {}).get('key')
    if key:
        out = {**out, **work_details(key)}
    return {k: v for k, v in out.items() if v}


def by_search(item):
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
        return {}
    work = max(docs, key=lambda d: d.get('edition_count') or 0)
    out = {**work, **work_details(work['key'])}
    if not w['substitute']:
        return out   # the subjects and a description; the ISBN stays as it is
    try:
        eds = http(f"https://openlibrary.org{work['key']}/editions.json?limit=100").get('entries', [])
    except Exception:
        return out
    def score(e):
        pubs = ' '.join(e.get('publishers') or [])
        fmt = (e.get('physical_format') or '').lower()
        return ((e.get('publish_country') or '').endswith('u') * 3 + (fmt in ('paperback', 'hardcover', 'trade paperback')) * 2
                - bool(BAD_EDITION.search(pubs + ' ' + fmt + ' ' + (e.get('edition_name') or ''))) * 10
                + ('eng' in json.dumps(e.get('languages') or [{'key': '/languages/eng'}])) * 1)
    for e in sorted(eds, key=score, reverse=True):
        i13 = next((i for i in e.get('isbn_13') or [] if ISBN13.fullmatch(i)), None)
        if i13 and score(e) >= 3:
            out.update({'isbn': i13, 'publisher': (e.get('publishers') or [None])[0], 'pages': e.get('number_of_pages')})
            break
    return out


def details(item):
    """Everything Open Library can add to a book we're about to import."""
    isbn, w = item
    out = {} if w['substitute'] else by_isbn(isbn)
    if not (out.get('subject') and out.get('publisher')):
        out = {**by_search(item), **out}
    return isbn, out


# Which of the catalogue's shelves are fiction, so an author's usual shelf is
# only borrowed when it agrees with the list the book charts on.
NONFICTION = {'Nonfiction', 'Biography', 'History', 'Science', 'Self-Help', 'Religion', 'Cooking'}


def author_shelf():
    """Where the catalogue shelves each author, for a forthcoming book that
    neither Open Library nor the NYT has anything to say about yet: an author
    whose books we file under Romance is, on the whole, writing Romance."""
    from collections import Counter, defaultdict
    per = defaultdict(Counter)
    for r in all_books('author,category'):
        if r.get('author') and r.get('category'):
            per[key(r['author'])][r['category']] += 1
    out = {}
    for author, shelves in per.items():
        (shelf, n), = shelves.most_common(1)
        if n >= 2 and n >= 0.6 * sum(shelves.values()):
            out[author] = shelf
    return out


def category(subjects, hint, nyt=None, usual=None):
    text = ' | '.join(subjects or [])
    if re.search(r'picture books|stories in rhyme|board books', text, re.I): return 'Picture Books'
    if re.search(r'graphic novels|comic books, strips', text, re.I): return 'Graphic Novels'
    if re.search(r'young adult', text, re.I): return 'YA'
    if re.search(r'juvenile', text, re.I): return hint if hint in ('Picture Books', 'YA') else 'Kids'
    if hint: return hint
    fiction = re.search(r'\bfiction\b|\bnovel|nyt:.*(?<!non)fiction', text, re.I) and nyt != 'Nonfiction'
    if fiction:
        for cat, rx in [('Fantasy', r'fantasy'), ('Sci-Fi', r'science fiction'), ('Mystery', r'mystery|detective'),
                        ('Thriller', r'thriller|suspense'), ('Romance', r'romance|love stories')]:
            if re.search(rx, text, re.I): return cat
        return 'Fiction'
    for cat, rx in [('Biography', r'biograph|memoir'), ('Cooking', r'cook|recipes'), ('History', r'\bhistory\b'),
                    ('Science', r'\bscience'), ('Self-Help', r'self-help|conduct of life'), ('Religion', r'religio|christian')]:
        if re.search(rx, text, re.I): return cat
    # The author's usual shelf, then the list it charts on, then a guess.
    if usual and (not nyt or (usual in NONFICTION) == (nyt == 'Nonfiction')): return usual
    if nyt: return nyt
    return 'Nonfiction' if subjects else 'Fiction'


def build(args):
    want = wanted()
    have = {(r.get('isbn') or '').lstrip(':') for r in all_books('id,isbn')} | {r['id'] for r in all_books('id')}
    want = {i: w for i, w in want.items() if i not in have}
    print(f'{len(want)} books to add; looking them up on Open Library')
    with ThreadPoolExecutor(max_workers=4) as pool:
        found = dict(pool.map(details, want.items()))

    print('resolving author names against the catalogue')
    people = Authors(offline=args.no_author_lookup)
    usual = author_shelf()
    today = date.today().isoformat()
    rows, review, seen = [], [], set(have)
    for isbn, w in sorted(want.items(), key=lambda kv: (kv[1]['publication_date'] or '', kv[0]), reverse=True):
        d = found.get(isbn) or {}
        best = d.get('isbn') or isbn
        if best in seen:
            continue  # we already carry that edition, or another source chose it
        seen.add(best)
        title = w['title']
        if (':' not in title and d.get('subtitle') and len(d['subtitle']) < 80 and d['subtitle'][:1].isupper()
                and fold(d['subtitle']) not in fold(title)):
            title = f"{title}: {d['subtitle']}"
        if NOT_A_BOOK.search(title):
            continue   # Open Library knows the ISBN as a boxed set
        author = people.canonical(w['author'])
        published = w['publication_date']
        row = {
            'id': best, 'isbn': best, 'title': title, 'author': author,
            'description': (w['description'] or d.get('description') or '').strip()[:4000] or None,
            'price': 0, 'cover_url': w['cover'] if best == isbn else None,
            'category': CATEGORY_OVERRIDES.get(w['title']) or category(d.get('subject'), w['hint'], w['nyt'],
                                                                       usual.get(key(author))),
            'publisher': d.get('publisher'), 'page_count': d.get('pages'), 'publication_date': published,
            'inventory_count': 0, 'reserved_count': 0,
            'status': 'preorder' if published and published > today else 'out_of_stock', 'tags': [TAG],
        }
        row.update({k: v for k, v in MANUAL.get(best, {}).items() if k in row})
        if args.max and len(rows) >= args.max:
            break
        rows.append(row)
        review.append([best, isbn if best != isbn else '', row['title'], row['author'],
                       'manual' if w['author'] in people.manual else 'catalogue' if w['author'] != author else '',
                       row['category'], row['publisher'] or '', bool(row['description']), row['status'],
                       published or '', ' + '.join(sorted(w['sources'])), '; '.join(sorted(w['collections']))])
    (CACHE / 'import.json').write_text(json.dumps(rows, ensure_ascii=False, indent=0))
    with open(CACHE / 'import-review.csv', 'w', newline='') as f:
        wr = csv.writer(f)
        wr.writerow(['isbn', 'replaces source isbn', 'title', 'author', 'author from', 'category', 'publisher',
                     'has description', 'status', 'publication date', 'sources', 'collections'])
        wr.writerows(review)

    from collections import Counter
    counts = Counter(s for r in review for s in r[10].split(' + '))
    lines = [f'**{len(rows)} books ready to import.**', '',
             f"- where they show: {', '.join(f'{n} {s}' for s, n in counts.most_common())}",
             f"- {sum(1 for r in rows if r['status'] == 'preorder')} not out yet (status preorder), "
             f"{sum(1 for r in rows if r['description'])} with a description, "
             f"{sum(1 for r in rows if r['cover_url'])} with a cover",
             f"- categories: {', '.join(f'{c} {n}' for c, n in Counter(r['category'] for r in rows).most_common())}",
             f'- author names resolved to the catalogue\'s spelling: {len(people.resolved)}'
             + (f" ({', '.join(f'{k} -> {v}' for k, v in list(people.resolved.items())[:8])})" if people.resolved else '')]
    print('\n'.join(lines))
    print(f'review: {CACHE / "import-review.csv"}')
    return lines


def apply(args):
    key = secret_key()
    rows = json.loads((CACHE / 'import.json').read_text())
    existing = {r['id'] for r in all_books('id')} | {(r.get('isbn') or '').lstrip(':') for r in all_books('isbn')}
    rows = [r for r in rows if r['id'] not in existing]
    print(f'adding {len(rows)} books')
    for i in range(0, len(rows), 100):
        http(f'{SUPABASE_URL}/rest/v1/books', data=json.dumps(rows[i:i + 100]).encode(),
             headers={**write_headers(key), 'Prefer': 'resolution=ignore-duplicates,return=minimal'}, method='POST')
        print(f'  {min(i + 100, len(rows))}/{len(rows)}')
    print('done')
    return [f'**{len(rows)} books added to the catalogue.**'] if rows else ['Nothing new to add.']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='insert what the last build prepared')
    ap.add_argument('--max', type=int, default=0, help='import at most this many books')
    ap.add_argument('--no-author-lookup', action='store_true', help='skip search_authors; keep names as given')
    ap.add_argument('--summary', help='append a Markdown summary here (for the GitHub Actions job summary)')
    args = ap.parse_args()
    lines = apply(args) if args.apply else build(args)
    if args.summary:
        with open(args.summary, 'a') as f:
            f.write('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main()
