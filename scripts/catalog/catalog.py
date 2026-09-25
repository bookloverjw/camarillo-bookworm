"""Shared catalogue access for the cleanup and import scripts.

Reads with the site's public key, which sees the customer-facing columns
only (supabase/books-public-columns-2-lockdown.sql) - pass all_books() the
secret key to read sales figures. Writes need SUPABASE_SECRET_KEY in the
environment (the Supabase dashboard's secret key); it's never printed."""
import json, os, re, ssl, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / '.cache'
CACHE.mkdir(exist_ok=True)
UA = 'CamarilloBookworm-catalog/1.0 (www.camarillobookworm.com)'

try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = ssl.create_default_context()

_src = (ROOT / 'src' / 'lib' / 'supabase.ts').read_text()
SUPABASE_URL = re.search(r"https://[a-z0-9]+\.supabase\.co", _src).group(0)
PUBLIC_KEY = re.search(r"['\"](sb_publishable_[^'\"]+)['\"]", _src).group(1)


def http(url, data=None, headers=None, method=None, tries=5, timeout=60):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={'User-Agent': UA, **(headers or {})}, method=method)
            with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
                body = r.read().decode('utf-8')
                return json.loads(body) if body else None
        except urllib.error.HTTPError as e:
            if attempt == tries - 1 or e.code not in (429, 500, 502, 503, 504):
                raise
            time.sleep(int(e.headers.get('Retry-After') or 0) or 5 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError):
            if attempt == tries - 1:
                raise
            time.sleep(5 * (attempt + 1))


def all_books(fields, key=None, limit=None):
    """Every book, or just the first `limit` of them - enough to check that a
    column exists without reading 23,000 rows."""
    key = key or PUBLIC_KEY
    rows = []
    for offset in range(0, limit or 500000, 1000):
        page_size = min(1000, limit - offset) if limit else 1000
        q = urllib.parse.urlencode({'select': fields, 'order': 'id.asc', 'offset': offset, 'limit': page_size})
        page = http(f'{SUPABASE_URL}/rest/v1/books?{q}', headers={'apikey': key, 'Authorization': f'Bearer {key}'})
        rows += page
        if len(page) < page_size or (limit and len(rows) >= limit):
            return rows


def search_authors(q, key=None, max_rows=8):
    """The catalogue's fuzzy author search (supabase/author-search.sql), as
    {spelling: book count}. Accents and small misspellings are ignored, so this
    finds "Gabriel García Márquez" for "marquez". Use it to check one name
    against the catalogue without reading the whole table."""
    key = key or PUBLIC_KEY
    rows = http(f'{SUPABASE_URL}/rest/v1/rpc/search_authors',
                data=json.dumps({'q': q, 'max_rows': max_rows}).encode(),
                headers={'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    return {r['author']: r['book_count'] for r in rows or []}


def _checkouts():
    """This working copy, and the main one when this is a git worktree.

    A worktree's .git is a file pointing into the real repository, and
    .env.local is gitignored, so it only ever exists in the main checkout -
    which is where a script run from a worktree has to look for the keys."""
    yield ROOT
    link = ROOT / '.git'
    try:
        if link.is_file():
            gitdir = Path(link.read_text().partition('gitdir:')[2].strip())
            if 'worktrees' in gitdir.parts:
                main = gitdir.parents[len(gitdir.parts) - 1 - gitdir.parts.index('worktrees')]
                yield main.parent      # .../<repo>/.git -> .../<repo>
    except OSError:
        return


def _env_local(name):
    """A value from the project's .env.local (gitignored), if it's there."""
    for root in _checkouts():
        path = root / '.env.local'
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            k, _, v = line.partition('=')
            if k.strip() == name and v.strip():
                return v.strip().strip('"').strip("'")
    return None


def secret_key():
    key = (os.environ.get('SUPABASE_SECRET_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
           or _env_local('SUPABASE_SECRET_KEY'))
    if not key:
        sys.exit('Add SUPABASE_SECRET_KEY=sb_secret_... to .env.local in the project folder '
                 '(Supabase dashboard > Project Settings > API keys > secret key), or export it.')
    if key.startswith('sb_publishable_'):
        sys.exit('That is the publishable key; writes need the secret key (sb_secret_...).')
    return key


def write_headers(key):
    return {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'Prefer': 'return=minimal'}


def fold(s):
    return unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()


def words(s):
    return re.findall(r"[a-z0-9]+", fold(s).replace("'", ''))


REAL_ISBN = re.compile(r'97[89]\d{10}')


def isbn_of(row):
    i = (row.get('isbn') or row.get('id') or '').lstrip(':')
    return i if REAL_ISBN.fullmatch(i) else None
