#!/usr/bin/env python3
"""Monthly collections refresh.

  1. Book Club Picks: the latest picks from Reese's, Jenna's and Oprah's
     clubs, from their Wikipedia lists.
  2. Awards: new winners and finalists from the prizes' Wikipedia pages
     (existing results are never removed; a finalist can become a winner).
  3. Every collection: link books to the catalogue wherever we now carry
     them. A book already linked to a record that still exists keeps it, so
     hand-picked editions stay put.

  python3 scripts/collections/refresh.py [--summary summary.md]

Reads the catalogue with the site's public key; needs no secrets. The
monthly GitHub Action runs it and opens a pull request with the changes.
"""
import argparse, calendar, json, re, sys
from bs4 import BeautifulSoup
from common import COLLECTIONS, Catalogue, book_ref, wikipedia_html, write_json
import awards as award_parser

log = []


def say(line):
    print(line)
    log.append(line)


# ---- 1. book clubs -----------------------------------------------------------
CLUBS = [  # (key, name, Wikipedia page, which wikitable)
    ('reese', "Reese's Book Club", "Reese's Book Club", 0),
    ('jenna', 'Read with Jenna', 'Read with Jenna', 0),
    ('oprah', "Oprah's Book Club", "Oprah's Book Club 2.0", 0),
]
MONTHS = {m.lower(): i for i, m in enumerate(calendar.month_name) if m}
clean = lambda s: re.sub(r'\s+', ' ', re.sub(r'\[[^\]]*\]', '', s)).strip().strip('"“”').strip()


def month_of(text):
    t = text.lower()
    y = re.search(r'(20\d\d)', t)
    m = next((v for k, v in MONTHS.items() if k in t or re.search(rf'\b{k[:3]}\b', t)), None)
    return f'{y.group(1)}-{m:02d}' if y and m else None


def club_picks(page, which):
    soup = BeautifulSoup(wikipedia_html(page), 'lxml')
    tables = [t for t in soup.find_all('table') if 'wikitable' in (t.get('class') or [])]
    table = tables[which]
    heads = [clean(th.get_text(' ')).lower() for th in table.find('tr').find_all(['th', 'td'])]
    col = lambda *names: next(i for i, h in enumerate(heads) if any(n in h for n in names))
    ti, ai, di = col('title'), col('author'), 0
    picks = []
    for tr in table.find_all('tr')[1:]:
        cells = [clean(c.get_text(' ')) for c in tr.find_all(['td', 'th'])]
        if len(cells) <= max(ti, ai):
            continue
        when = month_of(cells[di])
        if when and cells[ti]:
            picks.append({'when': when, 'title': cells[ti], 'author': cells[ai]})
    return sorted(picks, key=lambda p: p['when'], reverse=True)


def refresh_book_clubs(cat):
    path = COLLECTIONS / 'book-club-picks.json'
    data = json.loads(path.read_text())
    before = {s['title']: {b['title'] for b in s['books']} for s in data['sections']}
    previous = {(b['title'], b['author']): b for s in data['sections'] for b in s['books']}
    sections = []
    for key, name, page, which in CLUBS:
        try:
            picks = club_picks(page, which)[:12]
        except Exception as e:
            say(f'- ⚠️ {name}: could not read Wikipedia ({e}); left as is')
            sections.append(next(s for s in data['sections'] if s['title'] == name))
            continue
        books = []
        for p in picks:
            y, m = map(int, p['when'].split('-'))
            note = f'{name} pick, {calendar.month_name[m]} {y}'
            books.append(book_ref(cat, p['title'], p['author'], note, previous.get((p['title'], p['author']))))
        new = [b['title'] for b in books if b['title'] not in before.get(name, set())]
        if new:
            say(f"- **{name}**: new picks — {', '.join(f'*{t}*' for t in new)}")
        sections.append({'title': name, 'books': books})
    data['sections'] = sections
    write_json(path, data)


# ---- 2. awards ---------------------------------------------------------------
def refresh_awards(cat):
    path = COLLECTIONS / 'awards.json'
    data = json.loads(path.read_text())
    known = {a['id'] for a in data['awards']}
    index = {(r['award'], r['year'], r['book']['title'].lower()): r for r in data['results']}
    latest = {}
    for r in data['results']:
        latest[r['award']] = max(latest.get(r['award'], 0), r['year'])
    try:
        parsed = award_parser.parse_all()
    except Exception as e:
        say(f'- ⚠️ Awards: could not read Wikipedia ({e}); left as is')
        return
    names = {a['id']: a['name'] for a in data['awards']}
    for e in parsed:
        if e['award'] not in known or e['year'] < latest.get(e['award'], 0) - 1:
            continue  # only this year's and last year's results can still change
        author = e['author'] + (' (illustrator)' if e['award'] == 'caldecott' and 'illustrator' not in e['author'] else '')
        existing = index.get((e['award'], e['year'], e['title'].lower()))
        if existing:
            if e['result'] == 'winner' and existing['result'] != 'winner':
                existing['result'] = 'winner'
                say(f"- **{names[e['award']]} {e['year']}**: *{e['title']}* is now the winner")
            continue
        result = {'award': e['award'], 'year': e['year'], 'result': e['result'],
                  'book': book_ref(cat, e['title'], author)}
        data['results'].append(result)
        index[(e['award'], e['year'], e['title'].lower())] = result
        say(f"- **{names[e['award']]} {e['year']}** {e['result']}: *{e['title']}* by {e['author']}")
    data['results'].sort(key=lambda r: (r['award'], -r['year'], r['result'] != 'winner'))
    write_json(path, data)


# ---- 3. catalogue links ------------------------------------------------------
def relink(cat, book):
    """Link to our record when we carry the book; returns what changed."""
    if book.get('catalogId') and book['catalogId'] in cat.by_id:
        return None
    lost = book.pop('catalogId', None)
    row = cat.match(book['title'], book['author'])
    if row:
        book['catalogId'] = row['id']
        if row.get('isbn'):
            book['isbn'] = row['isbn']
        if row.get('cover_url'):
            book['cover'] = row['cover_url']
        return 'linked'
    return 'unlinked' if lost else None


def refresh_links(cat):
    for path in sorted(COLLECTIONS.glob('*.json')):
        data = json.loads(path.read_text())
        books = ([r['book'] for r in data['results']] if path.name == 'awards.json'
                 else [b for s in data.get('sections', []) for b in s['books']])
        changes = [(relink(cat, b), b['title']) for b in books]
        linked = [t for c, t in changes if c == 'linked']
        unlinked = [t for c, t in changes if c == 'unlinked']
        if linked or unlinked:
            write_json(path, data)
            title = data.get('title', 'Award winners')
            if linked:
                say(f"- **{title}**: now links to our copies of {len(linked)} book(s): {', '.join(f'*{t}*' for t in linked[:8])}{'…' if len(linked) > 8 else ''}")
            if unlinked:
                say(f"- **{title}**: {len(unlinked)} book(s) no longer in the catalogue: {', '.join(f'*{t}*' for t in unlinked[:8])}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--summary', help='write a Markdown summary of the changes here')
    args = ap.parse_args()
    cat = Catalogue()
    print(f'{len(cat.rows)} catalogue records')
    sections = [('Book club picks', refresh_book_clubs), ('Awards', refresh_awards), ('Catalogue links', refresh_links)]
    out = []
    for heading, step in sections:
        log.clear()
        print(f'\n== {heading}')
        step(cat)
        out.append(f'### {heading}\n' + ('\n'.join(log) if log else '_No changes._'))
    if args.summary:
        open(args.summary, 'w').write('\n\n'.join(out) + '\n')


if __name__ == '__main__':
    sys.exit(main())
