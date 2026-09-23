#!/usr/bin/env python3
"""The catalogue's own spelling of an author's name.

Imports bring author names from wherever the book came from - the NYT lists,
ISBNdb, Open Library, our collection files - and those sources disagree about
accents, initials and small misspellings. Inserting a name as given would give
us "Gabriel Garcia Marquez" beside "Gabriel García Márquez": two authors as far
as the site is concerned, so a follow or a wishlist match finds half the books.

So before inserting, ask the catalogue what it already calls this author. The
SQL function search_authors(q, max_rows) (supabase/author-search.sql) is fuzzy
and ignores accents; it reads with the site's public key and needs no secret.
A match counts as confident only when the surname is the same and the rest
differs by nothing more than accents, punctuation, initials, or a letter or
two - never enough to turn one author into another.

manual_fixes.json is the hand-held override, shared with propose_fixes.py:
its "_authors" object maps any spelling to the name we want, and wins over
whatever search_authors says. Keys are matched loosely (case, accents and
punctuation are ignored), so one entry covers a name's variants:

    "_authors": {"gabriel garcia marquez": "Gabriel García Márquez"}

Keys beginning with "_" are ignored by propose_fixes.py, so the two scripts
share the file without stepping on each other.
"""
import json
from pathlib import Path
from catalog import PUBLIC_KEY, SUPABASE_URL, http, words

SUFFIXES = {'jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md'}


def key(name):
    """A name reduced to its comparable words: "J. K. Rowling" -> "j k rowling"."""
    return ' '.join(w for w in words(name) if w not in SUFFIXES)


def _overrides():
    path = Path(__file__).parent / 'manual_fixes.json'
    try:
        raw = json.loads(path.read_text()).get('_authors') or {}
    except Exception:
        return {}
    return {key(k): v for k, v in raw.items()}


def levenshtein(a, b, cap=3):
    """Edit distance between two short strings, giving up past `cap`."""
    if abs(len(a) - len(b)) > cap:
        return cap + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        row = [i]
        for j, cb in enumerate(b, 1):
            row.append(min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (ca != cb)))
        if min(row) > cap:
            return cap + 1
        prev = row
    return prev[-1]


def confidence(ours, theirs):
    """How sure we are that two spellings are the same author: 3 (the same
    name written differently), 2 (initials added or dropped), 1 (a small
    misspelling of the given names), or 0 (leave it alone)."""
    a, b = key(ours), key(theirs)
    if not a or not b:
        return 0
    if a == b:
        return 3
    ta, tb = a.split(' '), b.split(' ')
    if ta[-1] != tb[-1] or len(ta[-1]) < 3 or len(ta) < 2 or len(tb) < 2:
        return 0  # a different surname, or a single name: not ours to guess at
    # "Sarah J. Maas" and "Sarah Maas": the same author, one initial apart.
    if [w for w in ta if len(w) > 1] == [w for w in tb if len(w) > 1]:
        return 2
    # "Coleen Hoover" and "Colleen Hoover": same surname, a letter out.
    if ta[0][0] == tb[0][0] and len(a) >= 8 and levenshtein(a, b, 2) <= 2:
        return 1
    return 0


class Authors:
    """Canonical spellings, looked up once per name."""

    def __init__(self, offline=False):
        self.overrides = _overrides()
        self.offline = offline
        self.cache = {}
        self.resolved = {}   # name as given -> catalogue's spelling, where they differ
        self.manual = set()  # names manual_fixes.json decided

    def canonical(self, name):
        name = (name or '').strip()
        k = key(name)
        if not k:
            return name
        if k in self.cache:
            return self.cache[k]
        if k in self.overrides:
            out = self.overrides[k]
            self.manual.add(name)
        else:
            out = self._search(name) or name
        self.cache[k] = out
        if out != name:
            self.resolved[name] = out
        return out

    def _search(self, name):
        if self.offline:
            return None
        try:
            rows = http(f'{SUPABASE_URL}/rest/v1/rpc/search_authors',
                        data=json.dumps({'q': name, 'max_rows': 8}).encode(),
                        headers={'apikey': PUBLIC_KEY, 'Authorization': f'Bearer {PUBLIC_KEY}',
                                 'Content-Type': 'application/json'}, method='POST') or []
        except Exception:
            return None  # the catalogue can't say; keep the name we were given
        best = max(((confidence(name, r['author']), r.get('book_count') or 0, r['author']) for r in rows),
                   default=(0, 0, None))
        return best[2] if best[0] else None


if __name__ == '__main__':   # authors.py "Gabriel Garcia Marquez" ...
    import sys
    a = Authors()
    for arg in sys.argv[1:]:
        print(f'{arg!r} -> {a.canonical(arg)!r}')
