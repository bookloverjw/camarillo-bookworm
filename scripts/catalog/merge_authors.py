#!/usr/bin/env python3
"""File every author under one spelling.

The catalogue carries the same author several ways - "Sarah J. Maas" and
"Sarah J Maas", "Michae Connelly" and "Michael Connelly", "Guin Ursula Le" and
"Ursula K. Le Guin". Each spelling is its own author to the site: a separate
group on the author page, a separate thing to follow, and books missing from
"more by this author".

  python3 scripts/catalog/merge_authors.py                     # propose; writes the review CSV
  SUPABASE_SECRET_KEY=... python3 scripts/catalog/merge_authors.py --apply --dry-run
  SUPABASE_SECRET_KEY=... python3 scripts/catalog/merge_authors.py --apply
  SUPABASE_SECRET_KEY=... python3 scripts/catalog/merge_authors.py --undo .cache/undo-authors-<time>.json

Proposing writes .cache/author_merges.csv and changes nothing. Review it in a
spreadsheet: the first column says whether each merge will be made. It arrives
'yes' for the rules that cannot mean two different people (punctuation,
truncation, an initial against the name it stands for) and 'no' for the rules
that can - two people really do share a first and last name, so "John Green"
and "John Patrick Green" are offered, not assumed. Change the cells, save as
CSV, then --apply, which reads the file back and does only what it says. The
canonical column is yours to edit too: type the spelling you want if neither
of ours is the one on the cover.

--apply writes books.author, books.author_last and books.authors, moves any
follows in author_follows onto the canonical spelling, and records each merge
in manual_fixes.json under "_author_merges" so imports keep using it. Books
pinned by hand in manual_fixes.json are left alone. Every previous value goes
to .cache/undo-authors-<time>.json first, for --undo.
"""
import argparse, csv, json, time, urllib.parse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

from author_names import (CONFIDENCE, MANUAL_FIXES, SUFFIX, Name, canonical, fold, merge_lookup,
                          record_merges, relation, surname, tokens)
from catalog import CACHE, SUPABASE_URL, all_books, http, isbn_of, secret_key, write_headers

CSV_PATH = CACHE / 'author_merges.csv'
COLUMNS = ['merge', 'confidence', 'rule', 'canonical', 'variant', 'book_count',
           'open library says', 'sample titles']
AUTO = {'high'}                       # pre-ticked in the review file


# ------------------------------------------------------------------ clustering

def candidate_pairs(names):
    """Pairs worth comparing. Comparing all 11,000 names against each other is
    120 million pairs; two spellings of one author always share a whole word or
    the start of the surname, so block on those first."""
    buckets = defaultdict(set)
    for n in names:
        t = tokens(n)
        if not t:
            continue
        buckets['last:' + t[-1][:4]].add(n)
        buckets['first:' + t[0][:4]].add(n)
        for w in t:
            if len(w) >= 4:
                buckets['word:' + w].add(n)
    pairs = set()
    for members in buckets.values():
        if len(members) > 250:        # "books", "press", "the" - no signal, and quadratic
            continue
        members = sorted(members)
        for i, a in enumerate(members):
            for b in members[i + 1:]:
                pairs.add((a, b))
    return pairs


def _restore_accents(best, endorsed, group):
    """Open Library's spelling, when it is the one we picked with the accents or
    punctuation the POS ate - "Emily Brontë" where every spelling we hold says
    "Bronte". Same name, letter for letter once unaccented, so this stays a
    merge and not a guess at a different author."""
    for name in sorted(endorsed):
        if name not in group and relation(Name(best), Name(name)) == 'punctuation':
            return name
    return best


def cluster(counts, already_merged, ol=None):
    """Group the spellings. Returns [(canonical, variant, rule, spellings it moves), ...].

    Only the rules that cannot mean two different people join spellings into a
    group. The looser rules are offered one pair at a time and never chained:
    left to spread, "Dan Brown" reaches "Daniel Brown" reaches "Daniel James
    Brown", and three authors become one without any single step looking wrong.
    """
    ol = ol or {}
    names = [n for n in counts if ' '.join(tokens(n)) not in already_merged]
    parsed = {n: Name(n) for n in names}
    strong, weak = defaultdict(set), {}
    for a, b in candidate_pairs(names):
        rule = relation(parsed[a], parsed[b])
        if not rule:
            continue
        if CONFIDENCE[rule] == 'high':
            strong[a].add(b)
            strong[b].add(a)
        else:
            weak[(a, b)] = rule

    # The groups the certain rules make, and the spelling each one files under.
    canon_of, groups = {}, []
    for start in sorted(names, key=lambda n: (-counts[n], n)):
        if start in canon_of:
            continue
        group, stack = {start}, [start]
        canon_of[start] = None
        while stack:
            for nxt in strong[stack.pop()]:
                if nxt not in canon_of:
                    canon_of[nxt] = None
                    group.add(nxt)
                    stack.append(nxt)
        endorsed = {ol[n] for n in group if n in ol}
        best = canonical({n: counts[n] for n in group}, endorsed)
        for name in sorted(endorsed):                 # Open Library's accents, where ours were eaten
            if name not in group and relation(Name(best), Name(name)) == 'punctuation':
                best = name
                break
        for n in group:
            canon_of[n] = best
        groups.append((best, group))

    held = {best: group for best, group in groups}
    books_in = {best: sum(counts[n] for n in group) for best, group in groups}
    out = []
    for best, group in groups:
        for n in sorted(group - {best}, key=lambda n: (-counts[n], n)):
            out.append((best, n, relation(Name(best), parsed[n]) or 'linked', [n]))

    # One row per pair of groups a looser rule connects, best rule first.
    between = {}
    for (a, b), rule in weak.items():
        ca, cb = canon_of[a], canon_of[b]
        if ca == cb:
            continue
        pair = tuple(sorted((ca, cb)))
        if pair not in between or CONFIDENCE[rule] < CONFIDENCE[between[pair]]:
            between[pair] = rule                      # 'low' sorts after 'medium' and 'high'
    for (x, y), rule in between.items():
        endorsed = {ol[n] for n in (x, y) if n in ol}
        keep = canonical({x: books_in.get(x, 0), y: books_in.get(y, 0)}, endorsed)
        drop = y if keep == x else x
        out.append((keep, drop, rule, sorted(held[drop] & set(counts))))
    return out


# ------------------------------------------------------------------ the evidence


def open_library_names(books_by_author):
    """What Open Library calls the author of each spelling's books.

    Looked up by ISBN, so it is independent of how we spell the name - which
    makes it the one outside opinion on whether two spellings are one person.
    Reads the cache fetch_openlibrary.py fills; without it the column is empty
    and the rules stand on their own."""
    path = CACHE / 'openlibrary.json'
    if not path.exists():
        print(f'note: no {path.name} - run fetch_openlibrary.py first and Open Library will vet these merges')
        return {}
    ol = json.loads(path.read_text())

    def tidy(name):
        """Open Library catalogues some authors the library way round,
        "Peterson, Eugene H." Put the name back the way a cover prints it, so
        it can be compared with ours - but leave "Martin, Jr." alone."""
        head, sep, tail = name.partition(',')
        if not sep or not tail.strip() or SUFFIX.search(name):
            return name
        return f'{tail.strip()} {head.strip()}'

    out = {}
    for name, rows in books_by_author.items():
        seen = Counter()
        for r in rows:
            for doc in ol.get(isbn_of(r) or '', []):
                for n in doc.get('author_name') or []:
                    seen[tidy(n)] += 1
        if seen:
            out[name] = seen.most_common(1)[0][0]      # the name most of this spelling's books carry
    return out


def _same_name(a, b):
    """Two of Open Library's names that are one name written two ways."""
    return Name(a).key == Name(b).key or relation(Name(a), Name(b)) == 'punctuation'


def _inside(a, b):
    """One name sits whole inside the other: "Scholastic" in "Scholastic Inc."
    Not evidence either way, and not a disagreement."""
    x, y = tokens(a), tokens(b)
    if len(x) > len(y):
        x, y = y, x
    return any(y[i:i + len(x)] == x for i in range(len(y) - len(x) + 1))


def evidence(canon, variant, ol):
    """Open Library's word on one merge: (note for the CSV, 'agrees'/'objects'/'').

    It agrees when both spellings' books are filed under one name, and objects
    when they are filed under two - "Marc Brown" and "Marcia Brown" are two
    authors, and no rule about cut-off words can tell that from the inside.
    """
    mine, theirs = ol.get(canon), ol.get(variant)
    if not theirs and not mine:
        return '', ''
    if not theirs or not mine:
        known, name = (canon, mine) if mine else (variant, theirs)
        other = variant if known == canon else canon
        if _same_name(name, other) or _same_name(name, known) and _inside(name, other):
            return f'{known} is {name} there; nothing on {other}', ''
        verdict = '' if relation(Name(name), Name(other)) or _inside(name, other) else 'objects'
        return f'{known} is {name} there; nothing on {other}', verdict
    if _same_name(mine, theirs):
        return f'both are {mine} there', 'agrees'
    if _inside(mine, theirs):
        return f'{canon} is {mine} there, {variant} is {theirs}', ''
    return f'{canon} is {mine} there, {variant} is {theirs}', 'objects'


# ------------------------------------------------------------------ propose


def propose():
    books = all_books('id,isbn,author,author_last,authors,title')
    by_author = defaultdict(list)
    for r in books:
        if (r.get('author') or '').strip():
            by_author[r['author'].strip()].append(r)
    counts = {n: len(rows) for n, rows in by_author.items()}
    print(f'{len(books)} books, {len(counts)} spellings of an author')

    ol = open_library_names(by_author)
    groups = cluster(counts, merge_lookup(), ol)

    rows, objected, agreed = [], 0, 0
    for canon, variant, rule, moves in groups:
        conf = CONFIDENCE.get(rule, 'low')
        note, verdict = evidence(canon, variant, ol)
        if verdict == 'objects' and rule != 'punctuation':
            # Open Library files the two spellings under two authors. That
            # outweighs any rule about how the words look - except the one rule
            # it cannot be right about: two spellings that are the same letters
            # apart from accents, case and punctuation are the same name, and a
            # stray record on one of their books doesn't change that.
            objected += conf != 'low'
            conf = 'low'
        elif verdict == 'agrees':
            agreed += conf != 'high'
            conf = {'low': 'medium', 'medium': 'high', 'high': 'high'}[conf]
        titles = [r['title'] for n in moves for r in by_author[n] if r.get('title')][:3]
        rows.append({'merge': 'yes' if conf in AUTO else 'no', 'confidence': conf, 'rule': rule,
                     'canonical': canon, 'variant': variant,
                     'book_count': sum(counts[n] for n in moves),
                     'open library says': note, 'sample titles': ' | '.join(titles)})
    order = {'high': 0, 'medium': 1, 'low': 2}
    rows.sort(key=lambda r: (order[r['confidence']], -r['book_count'], r['canonical']))
    with open(CSV_PATH, 'w', newline='') as f:
        w = csv.DictWriter(f, COLUMNS)
        w.writeheader()
        w.writerows(rows)

    tally = defaultdict(lambda: [0, 0])
    for r in rows:
        tally[r['rule']][0] += 1
        tally[r['rule']][1] += r['book_count']
    print(f'{len({r["canonical"] for r in rows})} authors with more than one spelling, '
          f'{len(rows)} variants to fold in:')
    for rule, (n, b) in sorted(tally.items(), key=lambda kv: -kv[1][1]):
        print(f'  {CONFIDENCE.get(rule, "low"):6} {rule:16} {n:4} spellings  {b:5} books')
    if agreed:
        print(f'{agreed} were raised a level because Open Library files both spellings\' books '
              f'under one author')
    if objected:
        print(f'{objected} were dropped to the bottom because it files them under two')
    ticked = sum(1 for r in rows if r['merge'] == 'yes')
    print(f'\nreview: {CSV_PATH}')
    print(f'{ticked} are ticked to merge; the other {len(rows) - ticked} wait for you to change "no" to "yes".')
    print('Nothing has been written to the database.')


# ------------------------------------------------------------------ apply


def reviewed():
    """The merges the review file says to make."""
    if not CSV_PATH.exists():
        raise SystemExit(f'{CSV_PATH} is not there - run without --apply first, then review it.')
    with open(CSV_PATH, newline='') as f:
        rows = list(csv.DictReader(f))
    keep = [r for r in rows if (r.get('merge') or '').strip().lower() in ('yes', 'y', 'true', '1', 'x')]
    edges = [(r['variant'], r['canonical']) for r in keep
             if r['variant'] and r['canonical'] and r['variant'] != r['canonical']]

    # Every ticked row says two spellings are one author, so follow them all the
    # way through: "Jr Bill Martin" -> "Bill Jr Martin" -> "Bill Martin Jr." is
    # one author in three steps, and the last name is where the books go.
    group = {}
    for a, b in edges:
        ga, gb = group.setdefault(a, {a}), group.setdefault(b, {b})
        if ga is not gb:
            ga |= gb
            for name in gb:
                group[name] = ga
    variants = {a for a, _ in edges}
    merges, clashes = {}, {}
    for names in {id(g): g for g in group.values()}.values():
        # The spellings nothing points away from. One is the answer; two means
        # the same books are ticked for two different authors, which only the
        # reviewer can settle - "Margaret Brown" fits Margaret Wise Brown and
        # Margaret Brownley, and the rules cannot choose.
        ends = sorted(names - variants)
        if len(ends) != 1:
            clashes[min(names)] = ends or sorted(names)
            continue
        merges.update({n: ends[0] for n in names if n != ends[0]})
    if clashes:
        for start, ends in sorted(clashes.items()):
            print(f'  {start!r} and the spellings ticked with it lead to ' +
                  (' and '.join(repr(e) for e in ends) if len(ends) > 1 else 'no single author'))
        raise SystemExit(f'{len(clashes)} groups in {CSV_PATH.name} are ticked for more than one '
                         f'author; leave one merge ticked in each and try again.')
    return merges, len(rows)


def pinned_books():
    """Books whose author was set by hand in manual_fixes.json; never touched."""
    data = json.loads(MANUAL_FIXES.read_text()) if MANUAL_FIXES.exists() else {}
    return {k for k, v in data.items() if not k.startswith('_') and isinstance(v, dict) and 'author' in v}


def book_changes(merges):
    books = all_books('id,isbn,author,author_last,authors,title')
    pinned = pinned_books()
    changes = []
    for r in books:
        canon = merges.get((r.get('author') or '').strip())
        if not canon or r['id'] in pinned or (isbn_of(r) or '') in pinned:
            continue
        new = {'author': canon}
        want_last = surname(canon)
        if want_last and r.get('author_last') != want_last:
            new['author_last'] = want_last
        if r.get('authors'):
            # The POS's unpunctuated copy of the same credit line. A second name
            # in it gets its own canonical spelling, not this book's.
            swapped = [merges.get((a or '').strip(), canon if fold(a) == fold(r['author']) else a)
                       for a in r['authors']]
            if swapped != r['authors']:
                new['authors'] = swapped
        old = {k: r.get(k) for k in new}
        changes.append({'id': r['id'], 'new': new, 'old': old})
    return changes


def follows(key, variants):
    """Every follow on a spelling we are merging away."""
    out = []
    for i in range(0, len(variants), 40):
        chunk = ','.join('"' + v.replace('"', '\\"') + '"' for v in variants[i:i + 40])
        q = urllib.parse.urlencode({'select': 'id,customer_id,author', 'author': f'in.({chunk})'})
        out += http(f'{SUPABASE_URL}/rest/v1/author_follows?{q}',
                    headers={'apikey': key, 'Authorization': f'Bearer {key}'}) or []
    return out


def follow_changes(key, merges):
    """Follows to move, and follows to drop because the customer already follows
    the canonical spelling - author_follows is unique on (customer_id, author)."""
    rows = follows(key, sorted(merges))
    if not rows:
        return [], []
    held = defaultdict(set)
    q = urllib.parse.urlencode({'select': 'customer_id,author'})
    for r in http(f'{SUPABASE_URL}/rest/v1/author_follows?{q}',
                  headers={'apikey': key, 'Authorization': f'Bearer {key}'}) or []:
        held[r['customer_id']].add(r['author'])
    move, drop = [], []
    for r in rows:
        canon = merges[r['author']]
        if canon in held[r['customer_id']]:
            drop.append(r)
        else:
            held[r['customer_id']].add(canon)
            move.append(r)
    return move, drop


def patch_book(key, book_id, values):
    http(f"{SUPABASE_URL}/rest/v1/books?id=eq.{urllib.parse.quote(book_id)}",
         data=json.dumps(values).encode(), headers=write_headers(key), method='PATCH')


def run_pool(fn, items, label):
    done = failed = 0
    def one(item):
        try:
            fn(item)
            return True
        except Exception as e:
            print(f'  {item}: {e}')
            return False
    with ThreadPoolExecutor(max_workers=6) as pool:
        for ok in pool.map(one, items):
            done += ok
            failed += not ok
            if (done + failed) % 500 == 0:
                print(f'  {done + failed}/{len(items)}')
    print(f'{label}: {done} done, {failed} failed')
    return failed


def apply(dry_run):
    key = secret_key()
    merges, total = reviewed()
    if not merges:
        raise SystemExit(f'{CSV_PATH} has {total} rows and none ticked - set "merge" to yes on the ones you want.')
    changes = book_changes(merges)
    move, drop = follow_changes(key, merges)
    print(f'{len(merges)} spellings ticked of {total} proposed')
    print(f"{'would update' if dry_run else 'updating'} {len(changes)} books; "
          f'{len(move)} follows moved, {len(drop)} duplicate follows removed')
    if dry_run:
        for c in changes[:15]:
            print(f"  {c['id']}: {c['old']} -> {c['new']}")
        for r in move[:5]:
            print(f"  follow {r['id']}: {r['author']} -> {merges[r['author']]}")
        return

    undo = CACHE / f"undo-authors-{time.strftime('%Y%m%d-%H%M%S')}.json"
    undo.write_text(json.dumps({'books': [{'id': c['id'], 'old': c['old']} for c in changes],
                                'follows_moved': [{'id': r['id'], 'author': r['author']} for r in move],
                                'follows_removed': drop}, ensure_ascii=False))
    print(f'saved current values to {undo}')

    failed = run_pool(lambda c: patch_book(key, c['id'], c['new']), changes, 'books')
    if move:
        run_pool(lambda r: http(f"{SUPABASE_URL}/rest/v1/author_follows?id=eq.{r['id']}",
                                data=json.dumps({'author': merges[r['author']]}).encode(),
                                headers=write_headers(key), method='PATCH'), move, 'follows moved')
    if drop:
        run_pool(lambda r: http(f"{SUPABASE_URL}/rest/v1/author_follows?id=eq.{r['id']}",
                                headers=write_headers(key), method='DELETE'), drop, 'duplicate follows removed')
    if failed:
        print('some books did not update; their merges are NOT recorded, so re-running will retry them')
    else:
        print(f'recorded {record_merges(merges)} merges in {MANUAL_FIXES.name}')


def undo(path):
    key = secret_key()
    saved = json.loads(open(path).read())
    run_pool(lambda c: patch_book(key, c['id'], c['old']), saved['books'], 'books restored')
    run_pool(lambda r: http(f"{SUPABASE_URL}/rest/v1/author_follows?id=eq.{r['id']}",
                            data=json.dumps({'author': r['author']}).encode(),
                            headers=write_headers(key), method='PATCH'),
             saved.get('follows_moved', []), 'follows restored')
    gone = saved.get('follows_removed', [])
    if gone:
        http(f'{SUPABASE_URL}/rest/v1/author_follows',
             data=json.dumps([{k: r[k] for k in ('id', 'customer_id', 'author')} for r in gone]).encode(),
             headers={**write_headers(key), 'Prefer': 'resolution=ignore-duplicates,return=minimal'}, method='POST')
        print(f'{len(gone)} duplicate follows put back')
    print('the merges stay recorded in manual_fixes.json; take them out by hand if you meant to undo those too')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='make the merges the review CSV is ticked for')
    ap.add_argument('--dry-run', action='store_true', help='with --apply: say what would change, write nothing')
    ap.add_argument('--undo', help='an undo file from an earlier --apply')
    args = ap.parse_args()
    if args.undo:
        undo(args.undo)
    elif args.apply:
        apply(args.dry_run)
    else:
        propose()


if __name__ == '__main__':
    main()
