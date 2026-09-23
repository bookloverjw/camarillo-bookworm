#!/usr/bin/env python3
"""Put a person's name back on books filed under their publisher.

The POS files a lot of stock under whoever printed it - "Golden Books" for
The Saggy Baggy Elephant, "Books Priddy" for First 100 Words, "Foxfire Fund,
Inc." for Foxfire 4. The author page has nothing to show for them, they never
come up under their writer, and "more by this author" lists a publisher.

  python3 scripts/catalog/recover_authors.py                      # propose; writes the review CSV
  SUPABASE_SECRET_KEY=... python3 scripts/catalog/recover_authors.py --apply --dry-run
  SUPABASE_SECRET_KEY=... python3 scripts/catalog/recover_authors.py --apply
  SUPABASE_SECRET_KEY=... python3 scripts/catalog/recover_authors.py --undo .cache/undo-recovery-<time>.json

Open Library is the only evidence, looked up by ISBN, and it does not say who
wrote a book and who drew it - so for a picture book its first name is as
likely to be the illustrator. Nothing is ticked to start with. Read the title
against the name and tick what you recognise; the CSV carries every name Open
Library lists, so a wrong first guess is usually visible.

Confidence is about how well the name is corroborated, not about whether it is
the writer rather than the artist:
  high    one name, and we already stock that author
  medium  one name, new to the catalogue
  low     several names; the first is proposed and the rest are in the CSV

--apply writes books.author, books.author_last and books.authors, and fills in
books.publisher with the name being replaced when that column is empty, so the
printer isn't simply lost. Books pinned by hand in manual_fixes.json are left
alone. Previous values go to .cache/undo-recovery-<time>.json first.
"""
import argparse, csv, json, time
from collections import Counter, defaultdict

from author_names import (CORPORATE, Name, canonical_author, fold, merge_lookup, relation, surname, tokens)
from catalog import CACHE, all_books, isbn_of, secret_key
from merge_authors import patch_book, pinned_books, run_pool

CSV_PATH = CACHE / 'author_recovery.csv'
COLUMNS = ['recover', 'confidence', 'isbn', 'filed under', 'proposed author',
           'other names on open library', 'in our catalogue', 'title', 'category', 'publisher']

# Names that stand in for nobody.
PLACEHOLDER = {'various', 'unknown', 'anonymous', 'anon', 'assorted', 'staff',
               'editors', 'editor', 'team', 'na'}
# Wider than author_names.CORPORATE, which is only about where a company's name
# ends. Open Library credits a great many outfits as the author, and every one
# of them that gets through here lands on the site as a person.
ORGANISATION = CORPORATE | PLACEHOLDER | {
    'gift', 'gifts', 'firm', 'services', 'service', 'foundation', 'society', 'association',
    'institute', 'museum', 'magazine', 'today', 'news', 'network', 'entertainment',
    'productions', 'production', 'workshop', 'works', 'labs', 'international', 'worldwide',
    'global', 'enterprises', 'holdings', 'imprint', 'imprints', 'employees', 'licensed',
    'llp', 'plc', 'gmbh', 'pty', 'kids', 'junior', 'learning', 'education', 'educational',
    'academy', 'school', 'university', 'college', 'council', 'committee', 'board', 'trust',
    'fund', 'project', 'crew', 'collective', 'designs', 'digital', 'syndicate', 'partners',
    'associates', 'ventures', 'brands', 'company', 'creative', 'illustrations',
    'readers', 'reader', 'edited', 'games', 'learners', 'disney'}
# Not 'art': Art Spiegelman and Art Garfunkel are people.


def companyish(name, publishers):
    """A printer, a studio or a placeholder rather than a person. A name that
    also appears in books.publisher counts - that is how "Scholastic" and
    "Galison" are caught, neither of which carries a company word."""
    t = set(tokens(name))
    return bool(t & CORPORATE) or bool(t & PLACEHOLDER) or name in publishers


def person(name, filed, publishers):
    """Looks like someone's name, and not the printer's under another guise.

    Three ways a company gets through otherwise: a word we don't list
    ("Christian Art Gifts"), a name we already know as a publisher ("USA
    Today", "Golden Books"), and the same outfit spelled differently from the
    name being replaced ("Chronicle Chronicle Books" for Chronicle Books)."""
    if not name or not Name(name).parts:
        return False
    if set(tokens(name)) & ORGANISATION:
        return False
    if name in publishers or '(' in name:
        return False
    mine, theirs = tokens(name), set(tokens(filed))
    if set(mine) <= theirs:
        return False                      # "American Profile" for "American Profile Staff"
    if any(a == b for a, b in zip(mine, mine[1:])):
        return False                      # "Thomas Thomas Nelson": a name doubled by bad data
    return relation(Name(name), Name(filed)) is None


def tidy(name):
    """Open Library catalogues some authors the library way round, "Friend,
    David". Put the name back the way a cover prints it."""
    head, sep, tail = name.partition(',')
    if not sep or not tail.strip() or len(tokens(tail)) > 2:
        return name.strip()
    return f'{tail.strip()} {head.strip()}'


# ------------------------------------------------------------------ propose


def propose():
    books = all_books('id,isbn,author,author_last,authors,title,category,publisher')
    path = CACHE / 'openlibrary.json'
    if not path.exists():
        raise SystemExit(f'{path} is not there - run fetch_openlibrary.py first; '
                         'Open Library is the only evidence this has.')
    ol = json.loads(path.read_text())
    publishers = {(r.get('publisher') or '').strip() for r in books if (r.get('publisher') or '').strip()}
    known = Counter(r['author'].strip() for r in books if (r.get('author') or '').strip())
    merges = merge_lookup()
    pinned = pinned_books()

    rows, skipped = [], Counter()
    for r in books:
        filed = (r.get('author') or '').strip()
        if not filed or not companyish(filed, publishers):
            continue
        if r['id'] in pinned or (isbn_of(r) or '') in pinned:
            skipped['pinned by hand'] += 1
            continue
        docs = ol.get(isbn_of(r) or '')
        if not docs:
            skipped['not on Open Library'] += 1
            continue
        seen = []
        for d in docs:
            for n in d.get('author_name') or []:
                n = tidy(n)
                if n not in seen:
                    seen.append(n)
        # Open Library naming the person already on the book settles it: this is
        # a writer whose name doubles as their imprint, not a publisher credit.
        # Without this, self-published authors lose their books to whoever drew
        # them - Aaron Johnson to Anne Zimanski.
        if any(fold(n) == fold(filed) for n in seen) and not (set(tokens(filed)) & ORGANISATION):
            skipped['Open Library names the author already on it'] += 1
            continue
        people = [n for n in seen if person(n, filed, publishers)]
        if not people:
            skipped['no person named there'] += 1
            continue
        # File them under the spelling the catalogue already uses, so recovering
        # an author can't start a second version of their name.
        best = canonical_author(people[0], known, merges)
        if fold(best) == fold(filed):
            skipped['already filed under that name'] += 1
            continue
        in_catalogue = known.get(best, 0)
        conf = 'low' if len(people) > 1 else ('high' if in_catalogue else 'medium')
        rows.append({'recover': 'no', 'confidence': conf, 'isbn': isbn_of(r), 'filed under': filed,
                     'proposed author': best,
                     'other names on open library': '; '.join(n for n in seen if n != people[0]),
                     'in our catalogue': in_catalogue or '', 'title': r.get('title') or '',
                     'category': r.get('category') or '', 'publisher': r.get('publisher') or ''})

    order = {'high': 0, 'medium': 1, 'low': 2}
    rows.sort(key=lambda r: (order[r['confidence']], r['filed under'], r['title']))
    with open(CSV_PATH, 'w', newline='') as f:
        w = csv.DictWriter(f, COLUMNS)
        w.writeheader()
        w.writerows(rows)

    by_conf = Counter(r['confidence'] for r in rows)
    print(f'{len(rows)} books could get a person\'s name back:')
    for c in ('high', 'medium', 'low'):
        if by_conf[c]:
            print(f'  {c:6} {by_conf[c]:4}')
    print('  passed over: ' + ', '.join(f'{n} {why}' for why, n in skipped.most_common()))
    top = Counter(r['filed under'] for r in rows)
    print('\nmost of them are filed under:')
    for name, n in top.most_common(8):
        print(f'  {n:4}  {name}')
    print(f'\nreview: {CSV_PATH}')
    print('Nothing is ticked and nothing has been written. Open Library does not say who wrote a')
    print('book and who illustrated it, so each of these wants your eye on the title.')


# ------------------------------------------------------------------ apply


REAL_ISBN = __import__('re').compile(r'97[89]\d{10}')


def reviewed():
    if not CSV_PATH.exists():
        raise SystemExit(f'{CSV_PATH} is not there - run without --apply first, then review it.')
    with open(CSV_PATH, newline='') as f:
        rows = list(csv.DictReader(f))
    keep = [r for r in rows if (r.get('recover') or '').strip().lower() in ('yes', 'y', 'true', '1', 'x')
            and r.get('proposed author')]
    mangled = sum(1 for r in keep if not REAL_ISBN.fullmatch((r.get('isbn') or '').strip()))
    if mangled:
        # A spreadsheet reads a 13-digit ISBN as a number and saves it back as
        # 9.78031E+12, which no longer names any book. The title and the name it
        # is filed under come through untouched, so match on those instead.
        print(f'{mangled} of {len(keep)} ticked rows have an ISBN a spreadsheet rounded off '
              f'(9.78031E+12 and the like); matching those on title and publisher instead.')
    return keep, len(rows)


def book_changes(picks):
    books = all_books('id,isbn,author,author_last,authors,title,publisher')
    pinned = pinned_books()
    by_isbn = {isbn_of(r): r for r in books if isbn_of(r)}
    by_title = defaultdict(list)
    for r in books:
        by_title[(fold(r.get('author')), fold(r.get('title')))].append(r)

    # Several books can share a title and a publisher - two "Baby Touch and
    # Feel" from DK, three "No Fear" from SparkNotes. Without the ISBN they can
    # only be told apart when every ticked row for that title wants the same
    # author, which for a series it usually does.
    agreed = defaultdict(set)
    for pick in picks:
        agreed[(fold(pick['filed under']), fold(pick['title']))].add(pick['proposed author'])
    taken = set()

    changes, missed = [], []
    for pick in picks:
        r = by_isbn.get((pick.get('isbn') or '').strip())
        if r is None:
            key = (fold(pick['filed under']), fold(pick['title']))
            fits = [x for x in by_title.get(key, []) if x['id'] not in taken]
            r = fits[0] if fits and (len(by_title[key]) == 1 or len(agreed[key]) == 1) else None
            if r is not None:
                taken.add(r['id'])
        filed = (r.get('author') or '').strip() if r else ''
        if r is None or filed != pick['filed under']:
            missed.append(pick)
            continue
        if r['id'] in pinned or (isbn_of(r) or '') in pinned:
            continue
        author = pick['proposed author']
        new = {'author': author}
        want_last = surname(author)
        if want_last and r.get('author_last') != want_last:
            new['author_last'] = want_last
        if r.get('authors'):
            new['authors'] = [author if fold(a) == fold(filed) else a for a in r['authors']]
            if new['authors'] == r['authors']:
                del new['authors']
        if not (r.get('publisher') or '').strip():
            new['publisher'] = filed          # don't lose who printed it
        changes.append({'id': r['id'], 'new': new, 'old': {k: r.get(k) for k in new}})
    for pick in missed:
        print(f"  no book matches {pick['title'][:40]!r} filed under {pick['filed under']!r}")
    if missed:
        print(f'{len(missed)} ticked rows matched no book and were left alone')
    return changes


def apply(dry_run):
    key = secret_key()
    picks, total = reviewed()
    if not picks:
        raise SystemExit(f'{CSV_PATH} has {total} rows and none ticked - set "recover" to yes on the '
                         f'ones you want.')
    changes = book_changes(picks)
    if not changes:
        raise SystemExit(f'{len(picks)} rows are ticked but none of them name a book that is still '
                         f'filed the way the CSV says. Re-run without --apply to rebuild '
                         f'{CSV_PATH.name}, tick it again, and save it as CSV without letting a '
                         f'spreadsheet reformat the isbn column.')
    print(f'{len(picks)} books ticked of {total} proposed')
    print(f"{'would update' if dry_run else 'updating'} {len(changes)} books")
    if dry_run:
        for c in changes[:15]:
            print(f"  {c['id']}: {c['old']} -> {c['new']}")
        return
    undo = CACHE / f"undo-recovery-{time.strftime('%Y%m%d-%H%M%S')}.json"
    undo.write_text(json.dumps([{'id': c['id'], 'old': c['old']} for c in changes], ensure_ascii=False))
    print(f'saved current values to {undo}')
    run_pool(lambda c: patch_book(key, c['id'], c['new']), changes, 'books')


def undo(path):
    key = secret_key()
    saved = json.loads(open(path).read())
    run_pool(lambda c: patch_book(key, c['id'], c['old']), saved, 'books restored')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--undo')
    args = ap.parse_args()
    if args.undo:
        undo(args.undo)
    elif args.apply:
        apply(args.dry_run)
    else:
        propose()


if __name__ == '__main__':
    main()
