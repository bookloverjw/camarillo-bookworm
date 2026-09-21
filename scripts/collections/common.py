"""Shared pieces for the collections refresh: title/author matching against
the catalogue, and polite fetching from Wikipedia and Open Library."""
import json, re, time, unicodedata, urllib.error, urllib.parse, urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COLLECTIONS = ROOT / 'public' / 'collections'
UA = 'CamarilloBookworm-collections/1.0 (www.camarillobookworm.com)'


def get(url, tries=5, timeout=30):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode('utf-8')
        except urllib.error.HTTPError as e:
            if attempt == tries - 1 or e.code not in (429, 500, 502, 503, 504):
                raise
            # Rate limited: wait as long as asked, or back off.
            time.sleep(int(e.headers.get('Retry-After') or 0) or 10 * (attempt + 1))
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(3 * (attempt + 1))


_last_wiki = 0.0


def wikipedia_html(page):
    """A Wikipedia article's rendered HTML, a couple of seconds apart."""
    global _last_wiki
    time.sleep(max(0, 2 - (time.time() - _last_wiki)))
    _last_wiki = time.time()
    q = urllib.parse.urlencode({'action': 'parse', 'page': page, 'prop': 'text', 'format': 'json',
                                'formatversion': 2, 'redirects': 1})
    return json.loads(get(f'https://en.wikipedia.org/w/api.php?{q}'))['parse']['text']


# ---- matching ----------------------------------------------------------------

def fold(s):
    return unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()

# The POS truncates titles at about thirty characters and tacks on notes -
# "The Dutch House A Novel", "PACHINKO (NATIONAL BOOK AWARD" with the bracket
# never closed. Strip all of that.
TRAILERS = r' (a|an) (novel|memoir|thriller|graphic novel|novel in verse|mystery|story)\b.*$'
AWARD_NOTES = r' (a )?(printz|newbery|caldecott|national book|pulitzer|booker|hugo|edgar|eisner)\b.*$'


def norm_title(t):
    t = fold(t).split(':')[0]
    t = re.sub(r'\(.*$', '', t)
    t = re.sub(r"[^a-z0-9 ]", ' ', t.replace('&', ' and ').replace("'", ''))
    t = re.sub(r'\s+', ' ', t).strip()
    t = re.sub(TRAILERS, '', t)
    t = re.sub(AWARD_NOTES, '', t)
    return re.sub(r'^(the|a|an) ', '', t).strip()


def titles_match(want, have):
    """Equal, or one a long-enough prefix of the other (a truncated POS title,
    or a subtitle glued on without a colon) - but not series neighbours."""
    if want == have:
        return True
    short, long_ = sorted((want, have), key=len)
    return len(short) >= 12 and long_.startswith(short + ' ')


def surnames(author):
    a = fold(author).replace('(as ', ' and ').replace(')', '').replace('(illustrator', '')
    names = set()
    for part in re.split(r'\band\b|,|&|;|/|translated by|translation by|illustrated by', a):
        words = [w for w in re.findall(r"[a-z][a-z'-]+", part) if w not in ('jr', 'sr', 'ii', 'iii', 'by', 'with')]
        if words:
            names.add(words[-1])
    return names


# Other formats of a book, which shouldn't stand in for it.
NOT_THE_BOOK = re.compile(r'box set|boxed|graphic novel|special|collection|adapted for|young readers|for kids', re.I)
REAL_ISBN = re.compile(r'97[89]\d{10}')


class Catalogue:
    """The live catalogue, read with the site's public (read-only) key."""

    def __init__(self):
        src = (ROOT / 'src' / 'lib' / 'supabase.ts').read_text()
        self.url = re.search(r"https://[a-z0-9]+\.supabase\.co", src).group(0)
        self.key = re.search(r"['\"](sb_publishable_[^'\"]+|eyJ[^'\"]+)['\"]", src).group(1)
        self.rows, self.by_id = [], {}
        for offset in range(0, 200000, 1000):
            q = urllib.parse.urlencode({'select': 'id,isbn,title,author,cover_url,book_type',
                                        'order': 'id.asc', 'offset': offset, 'limit': 1000})
            req = urllib.request.Request(f'{self.url}/rest/v1/books?{q}',
                                         headers={'apikey': self.key, 'Authorization': f'Bearer {self.key}', 'User-Agent': UA})
            page = json.loads(urllib.request.urlopen(req, timeout=60).read())
            self.rows += page
            if len(page) < 1000:
                break
        self.by_first = defaultdict(list)
        for r in self.rows:
            r['_t'] = norm_title(r['title'] or '')
            self.by_id[r['id']] = r
            if r['_t']:
                self.by_first[r['_t'].split()[0]].append(r)

    def match(self, title, author):
        """The best catalogue record for a book, or None."""
        want = norm_title(re.sub(r'\s*\(?\bseries\)?\s*$', '', title, flags=re.I))
        if not want:
            return None
        names = surnames(author)
        rows = [r for r in self.by_first.get(want.split()[0], [])
                if titles_match(want, r['_t']) and any(n in fold(r['author']) for n in names)
                and (r.get('book_type') or '').lower() != 'audiobook' and not NOT_THE_BOOK.search(r['title'] or '')]
        rows.sort(key=lambda r: (r['_t'] != want, not REAL_ISBN.fullmatch((r.get('isbn') or '').lstrip(':')),
                                 not r.get('cover_url')))
        return rows[0] if rows else None


_ol_cache = {}


def open_library(title, author):
    """ISBN and cover for a book we don't carry: {'isbn', 'cover'} or {}."""
    key = (norm_title(title), tuple(sorted(surnames(author))))
    if key in _ol_cache:
        return _ol_cache[key]
    q = urllib.parse.urlencode({'title': title.split(':')[0], 'author': re.split(r',| and |\(', author)[0].strip(),
                                'fields': 'title,author_name,cover_i,isbn', 'limit': 5})
    out = {}
    try:
        docs = json.loads(get(f'https://openlibrary.org/search.json?{q}')).get('docs', [])
    except Exception:
        docs = []
    want, names = norm_title(title), surnames(author)
    for d in docs:
        if titles_match(want, norm_title(d.get('title', ''))) and any(n in fold(' '.join(d.get('author_name', []))) for n in names):
            isbn = next((i for i in d.get('isbn', []) if re.fullmatch(r'(97[89][01]|9798)\d{9}', i)), None)
            if isbn:
                out['isbn'] = isbn
            if d.get('cover_i'):
                out['cover'] = f"https://covers.openlibrary.org/b/id/{d['cover_i']}-L.jpg"
            break
    _ol_cache[key] = out
    return out


def book_ref(cat, title, author, note=None, previous=None):
    """A collection entry: our record when we carry it, else Open Library's."""
    out = {'title': title, 'author': author}
    row = cat.match(title, author)
    if row:
        out['catalogId'] = row['id']
        if row.get('isbn'):
            out['isbn'] = row['isbn']
        if row.get('cover_url'):
            out['cover'] = row['cover_url']
    elif previous and (previous.get('isbn') or previous.get('cover')):
        out.update({k: previous[k] for k in ('isbn', 'cover') if previous.get(k)})
    else:
        out.update(open_library(title, author))
    if note:
        out['note'] = note
    return out


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
