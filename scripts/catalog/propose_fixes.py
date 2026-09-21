#!/usr/bin/env python3
"""Propose catalogue fixes from Open Library's records (fetch_openlibrary.py
first). Nothing is written to the database; this makes a review file.

  SUPABASE_SECRET_KEY=... python3 scripts/catalog/propose_fixes.py

Needs the secret key because it sorts by sales_past12, which the public key
cannot read.

Three kinds of fix, each only when the evidence is clear:
  author    the POS scrambles and truncates names: "Pelt Shelby Van",
            "Brand Sanderson", "Guin Ursula Le". Fixed when every word of
            ours is the start of a word in Open Library's name for the book.
  title     ALL-CAPS or cut-off titles ("ELEANOR OLIPHANT IS COMPLETELY")
            become the full title, when ours is the start of it.
  category  adult books filed on the wrong side of fiction/nonfiction
            (Educated as Fiction), decided from Open Library's subjects and
            New York Times list tags. Kids' categories are left alone.

Writes .cache/fixes.json (for apply_fixes.py) and .cache/catalog-fixes.csv
(to review in a spreadsheet), plus .cache/unresolved.csv: best sellers filed
as Fiction that Open Library couldn't classify, to check by hand.
"""
import csv, json, re
from pathlib import Path
from catalog import CACHE, all_books, fold, isbn_of, secret_key, words

ol = json.loads((CACHE / 'openlibrary.json').read_text())
# sales_past12 is not readable with the public key.
books = all_books('id,isbn,title,author,category,genre,book_type,sales_past12', secret_key())

ADULT = {'Fiction', 'Nonfiction', 'Biography', 'History', 'Science', 'Self-Help', 'Religion', 'Cooking'}
FICTION_WORDS = re.compile(r'\bfiction\b|\bnovel|ficci[oó]n|romans|\bstories\b|short stories|poetry', re.I)
NONFICTION_TOPICS = [  # first match wins
    ('Biography', re.compile(r'biograph|memoir|autobiograph', re.I)),
    ('Cooking', re.compile(r'cook|recipes|baking|cuisine', re.I)),
    ('Self-Help', re.compile(r'self-help|self-realization|self-actualization|conduct of life|personal growth|success|habit|happiness|motivation', re.I)),
    ('Religion', re.compile(r'religio|christian life|bible|theology|spiritual|prayer|god\b', re.I)),
    ('Science', re.compile(r'\bscience|physics|biology|astronomy|mathemat|neuroscien|evolution|medicine|nature\b', re.I)),
    ('History', re.compile(r'\bhistory\b|historical\b(?!.*fiction)', re.I)),
]


def best_doc(row):
    """Open Library's record for this ISBN - the one whose author matches ours."""
    docs = ol.get(isbn_of(row) or '', [])
    ours = [w for w in words(row['author'] or '') if len(w) > 2]
    def fits(d):
        theirs = words(' '.join(d.get('author_name') or []))
        return any(t.startswith(w) for w in ours for t in theirs) if ours else True
    docs = [d for d in docs if d.get('author_name') and fits(d)]
    return max(docs, key=lambda d: len(d.get('subject') or []), default=None)


PARTICLES = {'van', 'von', 'le', 'la', 'de', 'du', 'del', 'der', 'di', 'da', 'st'}


def fixed_author(ours, doc):
    """Open Library's name for the author, when ours is clearly a mangled form of it:
    truncated words ("Brand Sanderson"), the POS's surname shuffle ("Pelt Shelby Van",
    "Bukowski,Charles"), or shouting/missing punctuation. Never just a different
    style of the same name (initials spelled out, a pen name, reordered names)."""
    names = doc.get('author_name') or []
    if not ours or len(names) != 1 or ' and ' in fold(ours) or re.search(r'[\d]', names[0]) or ',' in names[0]:
        return None
    theirs = names[0].strip()
    a, b = words(ours), words(theirs)
    if not a or ours == theirs:
        return None
    if a == b:  # same words: fix capitalisation ("Cormac Mccarthy"), bare initials ("C S Lewis"), "Bukowski,Charles"
        letters = lambda x: re.sub(r'[^A-Za-z]', '', x)
        bare_initials = re.search(r'\b[A-Z]\b(?!\.)', ours) and not re.search(r'\b[A-Z]\b(?!\.)', theirs)
        return theirs if (letters(ours) != letters(theirs) or bare_initials or re.search(r',\S', ours)) and not re.search(r',\s', ours) else None
    free, truncated = list(b), False
    for w in a:  # each of our words must start a distinct word of theirs
        hit = next((t for t in free if t == w), None) or next((t for t in free if t.startswith(w) and len(w) >= 2), None)
        if not hit:
            return None
        truncated |= hit != w
        free.remove(hit)
    reordered = [t for t in b if t in a or any(t.startswith(w) for w in a)] != [next(t for t in b if t == w or t.startswith(w)) for w in a]
    if free and not truncated:
        return None  # theirs adds names ours never had ("Scholastic Early Learners")
    if reordered and not (',' in ours or a[-1] in PARTICLES or (free and a[0] == b[-1])):
        return None  # "Trung Le Nguyen" is right; Open Library's "Le Nguyen Trung" isn't
    return theirs


SMALL = {'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'the', 'to', 'up', 'vs', 'with', 'from', 'into'}


def title_case(t):
    """Open Library often stores titles in sentence case ("Dog breath")."""
    out = []
    for i, w in enumerate(t.split(' ')):
        bare = w.lower().strip('"(\'')
        if i and bare in SMALL and not out[-1].endswith(':'):
            out.append(w.lower())
        else:
            out.append(w[:1].upper() + w[1:] if not w[:1].isupper() else w)
    return ' '.join(out)


def fixed_title(ours, doc):
    """The full, properly capitalised title, for ALL-CAPS or cut-off titles only."""
    theirs = (doc.get('title') or '').strip()
    if not theirs or theirs == ours or theirs.isupper() or '[' in theirs or theirs.count('(') != theirs.count(')'):
        return None
    strip = lambda x: re.sub(r'^(the|a|an) ', '', ' '.join(words(re.sub(r'\(.*$', '', x))))
    main = ours.split(':')[0]
    o, t = strip(main), strip(theirs)
    if not o or len(o) < 3:
        return None
    lower_share = sum(1 for w in theirs.split()[1:] if w[:1].islower() and w.lower() not in SMALL) / max(1, len(theirs.split()) - 1)
    better = title_case(theirs) if lower_share > 0.3 else theirs
    if o == t and ours.isupper():
        return better + (ours[ours.index(':'):].title() if ':' in ours else '')
    if t.startswith(o + ' ') or (t.startswith(o) and not t[len(o):len(o) + 1].isalpha()):
        if len(main) >= 26 and t != o:  # the POS cuts titles off around 30 characters
            return better
    return None


GENRE_HINT = {  # the POS's genre codes, where they name a specific nonfiction shelf
    'BIOG': 'Biography', 'Biography': 'Biography', 'Biography & Autobiography': 'Biography',
    'HIS': 'History', 'HSCH': 'History', 'History': 'History', 'SCI': 'Science', 'Science': 'Science', 'NAT': 'Science',
    'Cooking': 'Cooking', 'COOK': 'Cooking', 'Religion': 'Religion', 'CRST': 'Religion', 'Inspiration': 'Religion',
    'Body, Mind & Spirit': 'Self-Help', 'Psychology': 'Self-Help', 'SEL': 'Self-Help', 'Self-Help': 'Self-Help',
}
LITERARY = {'Poetry', 'Classics', 'Drama', 'Plays', 'POE', 'DRA'}


def fixed_category(row, doc):
    if row['category'] not in ADULT or (row.get('genre') or '') in LITERARY:
        return None
    subjects = doc.get('subject') or []
    text = ' | '.join(subjects)
    if re.search(r'juvenile|children|drama|plays|poetry|poems', text, re.I):
        return None
    nyt_fic = any(re.match(r'nyt:.*(?<!non)fiction', x) for x in subjects)
    nyt_non = any(re.match(r'nyt:.*nonfiction|nyt:advice', x) for x in subjects)
    fiction = nyt_fic or (not nyt_non and bool(FICTION_WORDS.search(text)))
    if row['category'] == 'Fiction' and (nyt_non or (len(subjects) >= 3 and not fiction)):
        return GENRE_HINT.get(row.get('genre') or '') or next((c for c, rx in NONFICTION_TOPICS if rx.search(text)), 'Nonfiction')
    if row['category'] != 'Fiction' and nyt_fic and not nyt_non:
        return 'Fiction'
    return None


fixes, unresolved = [], []
for row in books:
    doc = best_doc(row)
    change = {}
    if doc:
        if (a := fixed_author(row['author'], doc)):
            change['author'] = a
        if (t := fixed_title(row['title'] or '', doc)):
            change['title'] = t
        if (c := fixed_category(row, doc)):
            change['category'] = c
    elif row['category'] == 'Fiction' and (row.get('sales_past12') or 0) >= 3 and isbn_of(row):
        unresolved.append(row)
    if change:
        fixes.append({'id': row['id'], 'old': {k: row[k] for k in change}, 'new': change,
                      'sales_past12': row.get('sales_past12') or 0})

# Hand-checked fixes win over the automatic ones.
manual = {k: v for k, v in json.loads((Path(__file__).parent / 'manual_fixes.json').read_text()).items() if not k.startswith('_')}
by_id = {r['id']: r for r in books}
by_isbn = {isbn_of(r): r for r in books if isbn_of(r)}
fixes = [f for f in fixes if f['id'] not in manual and (isbn_of(by_id[f['id']]) not in manual)]
for key, change in manual.items():
    row = by_id.get(key) or by_isbn.get(key)
    if row:
        change = {k: v for k, v in change.items() if row.get(k) != v}
        if change:
            fixes.append({'id': row['id'], 'old': {k: row[k] for k in change}, 'new': change,
                          'sales_past12': row.get('sales_past12') or 0, 'manual': True})

(CACHE / 'fixes.json').write_text(json.dumps(fixes, ensure_ascii=False, indent=0))
with open(CACHE / 'catalog-fixes.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['id', 'field', 'current', 'proposed', 'sales_past12'])
    for fx in sorted(fixes, key=lambda x: -x['sales_past12']):
        for k in fx['new']:
            w.writerow([fx['id'], k, fx['old'][k], fx['new'][k], fx['sales_past12']])
with open(CACHE / 'unresolved.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['id', 'title', 'author', 'category', 'sales_past12'])
    for r in sorted(unresolved, key=lambda r: -(r.get('sales_past12') or 0)):
        w.writerow([r['id'], r['title'], r['author'], r['category'], r.get('sales_past12')])

count = lambda k: sum(1 for f in fixes if k in f['new'])
print(f"{len(books)} books; {sum(1 for r in books if best_doc(r))} found on Open Library")
print(f"proposed: {count('author')} authors, {count('title')} titles, {count('category')} categories")
from collections import Counter
print('category moves:', Counter(f"{f['old']['category']} -> {f['new']['category']}" for f in fixes if 'category' in f['new']).most_common(12))
print(f'{len(unresolved)} best-selling "Fiction" books not on Open Library, in unresolved.csv')
