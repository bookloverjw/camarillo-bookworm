"""Award results from the prizes' Wikipedia pages, as one normalised list.

Each prize's page has a results table; the parser finds it by its column
headings and reads year, title, author and result (winner or finalist).
Used by refresh.py, which only takes this year's and last year's results.
"""
import re
from datetime import date
from bs4 import BeautifulSoup
from common import wikipedia_html

MIN_YEAR = date.today().year - 2

def clean(text):
    text = re.sub(r'\[\s*[^\]]{1,6}\s*\]', '', text)      # [ bl ], [81], [a]
    text = text.replace('*', '').replace('†', '').replace('‡', '')
    text = re.sub(r'\s+', ' ', text).strip(' ,;')
    return text

def own_cells(tr):
    return tr.find_all(['td', 'th'], recursive=False)

def expand(table):
    """Rows as lists of cells with rowspan/colspan filled in."""
    rows, pending = [], {}
    trs = [tr for tr in table.find_all('tr') if tr.find_parent('table') is table]
    for tr in trs:
        cells, row, col, i = own_cells(tr), [], 0, 0
        while i < len(cells) or col in pending:
            if col in pending:
                cell, left = pending[col]
                row.append(cell)
                if left - 1 == 0: del pending[col]
                else: pending[col] = [cell, left - 1]
                col += 1
                continue
            c = cells[i]; i += 1
            rs = int(re.sub(r'\D', '', c.get('rowspan', '1')) or 1)
            cs = int(re.sub(r'\D', '', c.get('colspan', '1')) or 1)
            for _ in range(cs):
                row.append(c)
                if rs > 1: pending[col] = [c, rs - 1]
                col += 1
        rows.append((tr, row))
    return rows

def header_index(rows, names):
    """Map wanted column names to indexes using the first header row."""
    for tr, row in rows:
        heads = [clean(c.get_text(' ', strip=True)).lower() for c in row]
        if any(h for h in heads) and all(c.name == 'th' for c in own_cells(tr)):
            out = {}
            for key, options in names.items():
                for j, h in enumerate(heads):
                    if any(h.startswith(o) for o in options):
                        out[key] = j; break
            if 'title' in out: return out
    return None

def styled_winner(tr):
    if 'background' in (tr.get('style') or ''): return True
    for c in own_cells(tr):
        if 'background' in (c.get('style') or ''): return True
    return any(c.find('b') for c in own_cells(tr) if c.name == 'td')

def year_of(text):
    m = re.search(r'(19|20)\d{2}', text)
    return int(m.group(0)) if m else None

def parse_table(table, award, year=None, result_col=True):
    rows = expand(table)
    idx = header_index(rows, {
        'year': ['year'],
        'author': ['author', 'illustrator', 'creator', 'laureate'],
        'title': ['title', 'book', 'novel', 'work'],
        'result': ['result', 'award'],
    })
    if not idx: return []
    out = []
    for tr, row in rows:
        if all(c.name == 'th' for c in own_cells(tr)) and not any(c.name == 'td' for c in own_cells(tr)):
            continue
        get = lambda k: clean(row[idx[k]].get_text(' ', strip=True)) if k in idx and idx[k] < len(row) else ''
        y = year or year_of(get('year'))
        if not y or y < MIN_YEAR: continue
        title, author = get('title'), get('author')
        if not title or re.fullmatch(r'(19|20)\d0s', title): continue
        if 'result' in idx and result_col:
            raw = get('result').lower()
            if raw.startswith('win') or raw == 'won': result = 'winner'
            elif raw.startswith(('finalist', 'shortlist', 'honor', 'nominee')): result = 'finalist'
            else: continue                       # longlist and anything else
        else:
            result = 'winner' if styled_winner(tr) else 'finalist'
        out.append({'award': award, 'year': y, 'result': result, 'title': title, 'author': author})
    return out

def tables_with(soup, *heads):
    found = []
    for t in soup.find_all('table'):
        if 'wikitable' not in (t.get('class') or []): continue
        first = ' '.join(th.get_text(' ', strip=True).lower() for th in t.find_all('th')[:8])
        if all(h in first for h in heads) and 'year awarded' not in first:
            found.append(t)
    return found

def merge_coauthors(entries):
    merged = {}
    for e in entries:
        key = (e['award'], e['year'], e['title'].lower())
        if key in merged:
            if e['author'] and e['author'] not in merged[key]['author']:
                merged[key]['author'] = f"{merged[key]['author']} and {e['author']}".strip(' and')
            if e['result'] == 'winner': merged[key]['result'] = 'winner'
        else:
            merged[key] = dict(e)
    return list(merged.values())


SOURCES = {  # award id: (Wikipedia page, column headings that identify the table, has a result column)
    'nba-fiction': ('National Book Award for Fiction', ('year', 'author', 'title', 'result'), True),
    'nba-nonfiction': ('National Book Award for Nonfiction', ('year', 'author', 'title', 'result'), True),
    'nba-young-people': ("National Book Award for Young People's Literature", ('year', 'author', 'title', 'result'), True),
    'pulitzer-fiction': ('Pulitzer Prize for Fiction', ('year', 'author', 'work'), False),
    'pulitzer-nonfiction': ('Pulitzer Prize for General Nonfiction', ('year', 'author', 'book'), False),
    'hugo-novel': ('Hugo Award for Best Novel', ('year', 'author', 'novel'), False),
    'edgar-novel': ('Edgar Award for Best Novel', ('year', 'author', 'title', 'result'), True),
    'eisner-graphic-album': ('Eisner Award for Best Graphic Album — New', ('year', 'title', 'creators'), False),
    'eisner-graphic-memoir': ('Eisner Award for Best Graphic Memoir', ('year', 'title', 'authors'), False),
    'newbery': ('Newbery Medal', ('year', 'author', 'book', 'award'), True),
    'caldecott': ('Caldecott Medal', ('year', 'illustrator', 'book', 'award'), True),
    'printz': ('Michael L. Printz Award', ('year', 'author', 'book', 'result'), True),
    'booker': ('List of winners and nominated authors of the Booker Prize', ('year', 'award', 'author', 'title'), True),
}


def parse_all():
    entries = []
    for award, (page, heads, result_col) in SOURCES.items():
        soup = BeautifulSoup(wikipedia_html(page), 'lxml')
        for t in tables_with(soup, *heads):
            entries += parse_table(t, award, result_col=result_col)
    # Translated Literature: one table per year, the year in the heading above it.
    soup = BeautifulSoup(wikipedia_html('National Book Award for Translated Literature'), 'lxml')
    for t in tables_with(soup, 'author', 'title', 'result'):
        heading = t.find_previous(['h2', 'h3', 'h4'])
        y = year_of(heading.get_text()) if heading else None
        if y:
            entries += parse_table(t, 'nba-translated', year=y)
    return merge_coauthors(entries)
