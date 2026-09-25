#!/usr/bin/env python3
"""Credit the illustrator and the translator, so readers can search for them.

"The Odyssey by Homer, translated by Emily Wilson" and "The Day the Crayons
Quit by Drew Daywalt, illustrated by Oliver Jeffers" are two names each, and
the catalogue only carries one of them. This fills books.contributors, which
supabase/book-contributors.sql adds.

  python3 scripts/catalog/set_contributors.py                    # propose; writes the review CSV
  SUPABASE_SECRET_KEY=... python3 scripts/catalog/set_contributors.py --apply --dry-run
  SUPABASE_SECRET_KEY=... python3 scripts/catalog/set_contributors.py --apply
  SUPABASE_SECRET_KEY=... python3 scripts/catalog/set_contributors.py --undo .cache/undo-contributors-<time>.json

Two sources, and the CSV says which each row came from:
  open library  its edition record names a role outright - "Robert Fagles
                (Translator)", "illustrated by Stephen Marchesi". Free and
                checkable, but it has this for about a fifth of what we carry
                and nothing at all for Emily Wilson or Oliver Jeffers.
  curated       contributors.json, filled in by hand where Open Library is
                silent. Translators are keyed by ISBN, because a translation is
                an edition: our Norton Odyssey is Wilson's and our Penguin one
                is Fagles'.

Open Library is only asked about books likely to have either - children's books
and translations - which is a few hundred calls rather than the whole
catalogue. .cache/contributors-ol.json holds the answers; delete it to refetch.
"""
import argparse, csv, json, re, time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

from author_names import fold, tokens
from catalog import CACHE, all_books, http, isbn_of, secret_key
from merge_authors import patch_book, run_pool

CURATED = __import__('pathlib').Path(__file__).resolve().parent / 'contributors.json'
OL_CACHE = CACHE / 'contributors-ol.json'
CSV_PATH = CACHE / 'contributors.csv'
COLUMNS = ['keep', 'source', 'role', 'name', 'isbn', 'author', 'title', 'category']

KIDS = {'Picture Books', 'Kids', 'Graphic Novels', 'YA'}
# How Open Library writes a role, in by_statement and in contributions.
ROLES = [
    ('illustrator', re.compile(r'\b(ill|illus|illustrated|illustrator|pictures|drawings|'
                               r'decorations|engraved|photographs)\b\.?', re.I)),
    ('translator', re.compile(r'\b(tr|trans|translated|translator)\b\.?', re.I)),
]
# What Open Library wraps a name in: "Shepard, Ernest H. 1879-1976, ill.",
# "Rieu, E. V. (Emile Victor), 1887-1972", "illustrated by Stephen Marchesi".
LIFESPAN = re.compile(r',?\s*\d{4}(?:\s+\w+\s+\d{1,2})?\s*-\s*(\d{4})?\.?$')
# "Lay, Carol, author" - the role sits after the name, and swapping the comma
# without taking it off first gives "Carol, author Lay".
TRAILING_ROLE = re.compile(r',\s*(?:author|creator|writer|editor|compiler|adapter|narrator|'
                           r'contributor|colorist|letterer|inker|penciller)\b\.?\s*$', re.I)
PARENS = re.compile(r'\([^)]*\)')
CREDIT = re.compile(r'\((?:translator|illustrator|introduction|contributor|editor|foreword|'
                    r'afterword|photographer)\)', re.I)
# The words that join a role to a name, which are not part of it.
LEAD = re.compile(r'^(?:and\s+|with\s+|by\s+|from\s+the\s+\w+\s+|original\s+|new\s+|'
                  r'a\s+|an\s+|the\s+)+', re.I)


def tidy(name):
    name = TRAILING_ROLE.sub('', (name or '').strip())
    name = CREDIT.sub(' ', name)
    for _ in range(4):                                  # each pass can expose the next wrapper
        before = name
        for _, rx in ROLES:
            name = rx.sub(' ', name)
        name = PARENS.sub(' ', name)
        name = ' '.join(name.split()).strip(' .,;:')
        name = LIFESPAN.sub('', name).strip(' .,;:')
        name = TRAILING_ROLE.sub('', name).strip(' .,;:')
        name = LEAD.sub('', name).strip(' .,;:')
        if name == before:
            break
    head, sep, tail = name.partition(',')                # "Shepard, Ernest H." -> "Ernest H. Shepard"
    if sep and tail.strip() and len(tokens(head)) == 1 and 1 <= len(tokens(tail)) <= 3:
        name = f'{tail.strip()} {head.strip()}'
    return ' '.join(name.split()).strip(' .,;:')


# Take the name that FOLLOWS the credit, rather than deleting the credit and
# keeping whatever is left: "a new translation, edited by Luci Berkowitz" says
# translation and names an editor, and the difference is the whole point.
# Only the words that actually join a credit to a name may sit between them.
# Anything else means a second credit has started: "a new translation, edited
# by Luci Berkowitz" names an editor, not a translator.
JOIN = r'(?:\s+from\s+the\s+[\w-]+)?(?:\s+and\s+annotated)?(?:\s+into\s+[\w-]+(?:\s+verse)?)?\s+by\s+'
SAYS = [
    ('translator', re.compile(r'\btranslat(?:ed|ion|or)\b' + JOIN + r'(.+)', re.I)),
    ('illustrator', re.compile(r'\b(?:illustrat(?:ed|ions?|or)|pictures|drawings|decorations|'
                               r'photographs|engraved)\b' + JOIN + r'(.+)', re.I)),
]
# A contribution line's trailing role. Anything else - an introduction, an
# edition, notes - is somebody we are not crediting.
TAGGED = [
    ('translator', re.compile(r'[,(\s](?:tr|trans|translator)\b\.?\)?\s*$', re.I)),
    ('illustrator', re.compile(r'[,(\s](?:ill|illus|illustrator|photographer)\b\.?\)?\s*$', re.I)),
]
SPLIT = re.compile(r'\s+and\s+|\s*&\s*|\s*;\s*', re.I)


def each_name(blob):
    """The people in one credit.

    A comma means two different things: "Shepard, Ernest H." is one name the
    library way round, and "Coleman Barks, with John Moyne" is two. What comes
    before the comma tells them apart - a lone surname, or a whole name."""
    for chunk in SPLIT.split(BRACKETED.sub(' ', blob or '')):
        head = chunk.split(',')[0]
        parts = chunk.split(',') if ',' in chunk and len(tokens(head)) > 1 else [chunk]
        for part in parts:
            who = tidy(part)
            if who and 2 <= len(tokens(who)) <= 5 and not DROP.search(who):
                yield who


BRACKETED = re.compile(r'[\[\]]')
DROP = re.compile(r'\b(?:introduction|introd|foreword|afterword|notes?|edited|editor|preface|'
                  r'commentary|creator|verse|style)\b', re.I)


def roles_from(ed):
    """(role, name) pairs an Open Library edition names outright."""
    out = []
    for line in re.split(r'\s*;\s*', ed.get('by_statement') or ''):
        for role, rx in SAYS:
            hit = rx.search(line)
            if hit:
                out += [(role, who) for who in each_name(hit.group(1))]
                break
    for entry in ed.get('contributions') or []:
        for role, rx in TAGGED:
            if rx.search(entry):
                out += [(role, who) for who in each_name(rx.sub('', entry))]
                break
    seen, uniq = set(), []
    for role, name in out:
        key = (role, ' '.join(tokens(name)))       # "Ernest H. Shepard" is "Ernest H Shepard"
        if key not in seen:
            seen.add(key)
            uniq.append((role, name))
    return uniq


def candidates(books, curated, sweep=False):
    """What plausibly has an illustrator or a translator, kept narrow on purpose.

    Asking Open Library about all 7,800 children's books buys a fifth of them a
    credit, many of which turn out to be a co-author. The names worth having
    sit on the books the shop actually stacks up - a well-known picture book
    arrives in six editions - and on the translated ones, so by default it asks
    about those. --sweep asks about every children's book."""
    named = set(curated['translators'])
    stocked = Counter(fold(r.get('author') or '') for r in books if r.get('category') in KIDS)
    curated_authors = {fold(rule['author']) for rule in curated['illustrators']}
    out = []
    for r in books:
        i = isbn_of(r)
        if not i:
            continue
        author, kid = fold(r.get('author') or ''), r.get('category') in KIDS
        if i in named or author in curated_authors:
            out.append(r)                                  # the curated ones, to check them
        elif kid and (sweep or stocked[author] >= 8):
            out.append(r)                                  # an author we carry deep: a known name
        elif not kid and translated_looking(r):
            out.append(r)
    return out


ACCENTED = re.compile(r'[^\x00-\x7f]')


def translated_looking(row):
    """A book that reads like it came from another language: an author whose
    name carries accents or non-Latin characters."""
    return bool(ACCENTED.search(row.get('author') or ''))


def fetch_open_library(rows):
    cache = json.loads(OL_CACHE.read_text()) if OL_CACHE.exists() else {}
    todo = [r for r in rows if isbn_of(r) not in cache]
    print(f'{len(cache)} editions cached; asking Open Library about {len(todo)}')

    def one(r):
        i = isbn_of(r)
        try:
            ed = http(f'https://openlibrary.org/isbn/{i}.json', tries=2, timeout=20) or {}
        except Exception:
            return i, None
        return i, {'by_statement': ed.get('by_statement'), 'contributions': ed.get('contributions')}

    if todo:
        with ThreadPoolExecutor(max_workers=5) as pool:
            for n, (i, ed) in enumerate(pool.map(one, todo), 1):
                cache[i] = ed
                if n % 200 == 0:
                    OL_CACHE.write_text(json.dumps(cache))
                    print(f'  {n}/{len(todo)}')
        OL_CACHE.write_text(json.dumps(cache))
    return cache


def curated_for(row, curated):
    out = []
    for name in curated['translators'].get(isbn_of(row) or '', []):
        out.append(('translator', name))
    author, title = fold(row.get('author') or ''), fold(row.get('title') or '')
    for rule in curated['illustrators']:
        if fold(rule['author']) == author and fold(rule['title']) in title:
            out.append(('illustrator', rule['name']))
    return out


def propose(offline, sweep=False):
    curated = json.loads(CURATED.read_text())
    books = all_books('id,isbn,author,title,category')
    rows = candidates(books, curated, sweep)
    print(f'{len(rows)} books could have an illustrator or a translator, of {len(books)}')
    ol = {} if offline else fetch_open_library(rows)

    out, tally = [], Counter()
    for r in rows:
        found, seen = [], set()
        key = lambda role, name: (role, ' '.join(tokens(name)))
        for role, name in curated_for(r, curated):
            found.append(('curated', role, name))
            seen.add(key(role, name))
        ed = ol.get(isbn_of(r))
        for role, name in (roles_from(ed) if ed else []):
            if key(role, name) in seen or tokens(name) == tokens(r.get('author') or ''):
                continue                                   # already known, or it is the author
            seen.add(key(role, name))
            found.append(('open library', role, name))
        for source, role, name in found:
            tally[f'{source} {role}'] += 1
            out.append({'keep': 'yes', 'source': source, 'role': role, 'name': name,
                        'isbn': isbn_of(r), 'author': r.get('author') or '',
                        'title': r.get('title') or '', 'category': r.get('category') or ''})

    out.sort(key=lambda x: (x['source'] != 'curated', x['role'], x['name'], x['title']))
    with open(CSV_PATH, 'w', newline='') as f:
        w = csv.DictWriter(f, COLUMNS)
        w.writeheader()
        w.writerows(out)
    print(f'\n{len(out)} credits on {len({x["isbn"] for x in out})} books:')
    for k, n in sorted(tally.items()):
        print(f'  {k:26} {n}')
    people = Counter((x['role'], x['name']) for x in out)
    print('\nmost credited:')
    for (role, name), n in people.most_common(10):
        print(f'  {n:3}  {name} ({role})')
    print(f'\nreview: {CSV_PATH}')
    print('Every row is ticked; untick what you disagree with. Nothing has been written.')


# ------------------------------------------------------------------ apply


def reviewed():
    if not CSV_PATH.exists():
        raise SystemExit(f'{CSV_PATH} is not there - run without --apply first.')
    with open(CSV_PATH, newline='') as f:
        rows = list(csv.DictReader(f))
    keep = [r for r in rows if (r.get('keep') or '').strip().lower() in ('yes', 'y', 'true', '1', 'x')]
    by_book = defaultdict(list)
    for r in keep:
        by_book[(r['isbn'], fold(r['author']), fold(r['title']))].append({'name': r['name'], 'role': r['role']})
    return by_book, len(rows)


SQL_FILE = 'supabase/book-contributors.sql'


def require_column():
    """books.contributors has to exist before anything can be written to it.
    Without this the run dies on a bare HTTP 400 that says nothing."""
    try:
        all_books('id,contributors', limit=1)
    except Exception:
        raise SystemExit(f'books.contributors is not there yet. Run {SQL_FILE} in the Supabase SQL '
                         f'editor (or with psql) first; it adds the column, the two search functions '
                         f'and the grant, and is safe to re-run.')


def book_changes(by_book):
    require_column()
    books = all_books('id,isbn,author,title,contributors')
    wanted = {}
    for (isbn, author, title), people in by_book.items():
        wanted[isbn] = (author, title, people)
    changes, missed = [], set(wanted)
    for r in books:
        i = isbn_of(r)
        if i not in wanted:
            continue
        author, title, people = wanted[i]
        # The ISBN is the identity; the author and title only guard against a
        # spreadsheet having rounded the ISBN off into another book's.
        if fold(r.get('author') or '') != author or fold(r.get('title') or '') != title:
            continue
        missed.discard(i)
        if (r.get('contributors') or []) != people:
            changes.append({'id': r['id'], 'new': {'contributors': people},
                            'old': {'contributors': r.get('contributors')}})
    for i in sorted(missed):
        print(f'  no book matches isbn {i}')
    return changes


def apply(dry_run):
    key = secret_key()
    by_book, total = reviewed()
    if not by_book:
        raise SystemExit(f'{CSV_PATH} has {total} rows and none kept.')
    changes = book_changes(by_book)
    print(f'{len(by_book)} books ticked of {total} rows; '
          f"{'would update' if dry_run else 'updating'} {len(changes)}")
    if dry_run:
        for c in changes[:15]:
            print(f"  {c['id']}: {c['new']['contributors']}")
        return
    undo = CACHE / f"undo-contributors-{time.strftime('%Y%m%d-%H%M%S')}.json"
    undo.write_text(json.dumps([{'id': c['id'], 'old': c['old']} for c in changes], ensure_ascii=False))
    print(f'saved current values to {undo}')
    run_pool(lambda c: patch_book(key, c['id'], c['new']), changes, 'books')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--offline', action='store_true', help='curated credits only, ask Open Library nothing')
    ap.add_argument('--sweep', action='store_true', help="ask about every children's book, not just the well-stocked ones")
    ap.add_argument('--undo')
    args = ap.parse_args()
    if args.undo:
        key = secret_key()
        saved = json.loads(open(args.undo).read())
        run_pool(lambda c: patch_book(key, c['id'], c['old']), saved, 'books restored')
    elif args.apply:
        apply(args.dry_run)
    else:
        propose(args.offline, args.sweep)


if __name__ == '__main__':
    main()
