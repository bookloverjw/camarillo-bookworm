"""Shared catalogue access for the cleanup and import scripts.

Reads with the site's public key. Writes need SUPABASE_SECRET_KEY in the
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


def all_books(fields):
    rows = []
    for offset in range(0, 500000, 1000):
        q = urllib.parse.urlencode({'select': fields, 'order': 'id.asc', 'offset': offset, 'limit': 1000})
        page = http(f'{SUPABASE_URL}/rest/v1/books?{q}', headers={'apikey': PUBLIC_KEY, 'Authorization': f'Bearer {PUBLIC_KEY}'})
        rows += page
        if len(page) < 1000:
            return rows


def _env_local(name):
    """A value from the project's .env.local (gitignored), if it's there."""
    path = ROOT / '.env.local'
    if path.exists():
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
