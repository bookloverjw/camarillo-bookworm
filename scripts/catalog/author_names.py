"""How one author's name is written, and when two spellings are the same person.

The POS scrambles, truncates and strips punctuation from names, so the same
author arrives as "Sarah J. Maas" and "Sarah J Maas", "Michae Connelly" and
"Michael Connelly", "Guin Ursula Le" and "Ursula K. Le Guin". merge_authors.py
clusters the catalogue with these rules; import_collection_books.py uses
canonical_author() so an import can't put a fresh variant back.

Every rule carries a confidence, because only some of them are safe without a
human eye: two people really can share a first and last name ("John Green" and
"John Patrick Green" are different authors), so those land in 'medium'/'low'
for review rather than being merged outright.
"""
import json, re, unicodedata
from pathlib import Path

MANUAL_FIXES = Path(__file__).resolve().parent / 'manual_fixes.json'
MERGE_KEY = '_author_merges'

# Two names joined into one field: never merged with anything, the parts are
# not one person's name.
MULTI = re.compile(r'\s(and|with)\s|&|;|/|\bed(itor)?s\b|,\s*\w+\s+\w', re.I)
# A trailing honorific, with or without the comma: "Bill Martin, Jr.", "Andrew
# Weil, M.D.". Dropped before comparing, kept in the name we settle on.
SUFFIX = re.compile(r'[\s,]+(jr|sr|ii|iii|iv|m\.?\s?d|ph\.?\s?d|d\.?\s?d\.?s|ed\.?\s?d|r\.?n|dvm|m\.?s\.?w|m\.?p\.?h|esq)\.?\s*$', re.I)
# Words that belong to the surname after them: "Van Pelt", "Le Guin", "de la Cruz".
PARTICLES = {'van', 'von', 'le', 'la', 'de', 'du', 'del', 'der', 'di', 'da', 'st', 'ten', 'ter', 'den', 'bin', 'ibn'}


def fold(s):
    return unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()


def tokens(s):
    return re.findall(r'[a-z0-9]+', fold(s).replace("'", '').replace('’', ''))


def trigrams(s):
    """pg_trgm's trigrams of the unaccented name, so a score here means what
    search_authors() would report for the same pair."""
    out = set()
    for w in tokens(s):
        padded = '  ' + w + ' '
        out |= {padded[i:i + 3] for i in range(len(padded) - 2)}
    return out


def similarity(a, b):
    x, y = trigrams(a), trigrams(b)
    return len(x & y) / len(x | y) if x | y else 0.0


class Name:
    """One spelling, split into given name / middles / surname.

    `parts` is None for anything that isn't one person's name - a publisher
    with a comma, two authors in one field, a single word - and such a name is
    only ever matched by punctuation, never by the looser rules."""

    def __init__(self, raw):
        self.raw = raw.strip()
        self.key = ' '.join(tokens(self.raw))      # accents, case and punctuation removed
        body = SUFFIX.sub('', self.raw)
        self.bare = ' '.join(tokens(body))         # ... and without the honorific
        t = tokens(body)
        self.parts = None
        if len(t) >= 2 and not MULTI.search(self.raw):
            n = 1
            while len(t) - n > 1 and t[-n - 1] in PARTICLES:
                n += 1
            self.parts = (t[0], tuple(t[1:len(t) - n]), tuple(t[len(t) - n:]))  # first, middles, surname

    @property
    def bag(self):
        return tuple(sorted(tokens(SUFFIX.sub('', self.raw))))

    def __repr__(self):
        return f'Name({self.raw!r})'


def _prefix_pair(a, b):
    return a.startswith(b) or b.startswith(a)


def _cut(a, b):
    """How much of a name the other is missing, when every word of one is the
    start of the matching word of the other. (letters dropped, words affected),
    or None if they aren't that shape."""
    if len(a) != len(b) or a == b or not all(_prefix_pair(x, y) for x, y in zip(a, b)):
        return None
    gaps = [abs(len(x) - len(y)) for x, y in zip(a, b)]
    return sum(gaps), sum(1 for g in gaps if g)


def _truncation_rule(a, b):
    """The POS cuts names off mid-word - "Michae Connelly", "Rain Telgemeier",
    "Margare Hillert" - and nearly always loses one letter of one word. A wider
    gap is far more likely to be a nickname or a different person: "Jeff Brown"
    is not a cut-off "Jeffrey Brown", "Marc Brown" is not "Marcia Brown", and
    "Joan Holub" is not "Joanna Ho"."""
    cut = _cut(a, b)
    if not cut:
        return None
    dropped, affected = cut
    if affected != 1:
        return None
    if dropped == 1:
        return 'truncated'
    where = next(i for i, (x, y) in enumerate(zip(a, b)) if x != y)
    short = min(len(a[where]), len(b[where]))
    # Two letters gone is still the POS at "Callis Gingrich" and "Melis
    # Lagonegro", but it is also a whole shorter name at "Dan Smith" for Danez
    # and a different surname at "Margaret Peters" for Peterson.
    if dropped == 2 and short >= 4 and where < len(a) - 1:
        return 'truncated'
    return 'shortened'



def _shuffled_subset(a, b):
    """All of the shorter name's words are in the longer one, out of order: the
    POS keeping the surname and dropping the given name, "Marquez Garcia" for
    "Gabriel Garcia Marquez". Often two different people, so: low confidence."""
    x, y = tokens(SUFFIX.sub('', a.raw)), tokens(SUFFIX.sub('', b.raw))
    if len(x) > len(y):
        x, y = y, x
    if len(x) < 2 or len(x) == len(y) or not set(x) < set(y):
        return False
    rest = iter(y)
    return not all(w in rest for w in x)      # in the same order would just be a shortening


# How far a spelling can be from another and still be worth a look. pg_trgm's
# own default is 0.3, which at this length pairs unrelated people.
SIMILAR_THRESHOLD = 0.80

# Only 'high' is safe to take in bulk. The rest are real candidates that also
# describe two different people, so they wait for the review CSV.
CONFIDENCE = {'punctuation': 'high', 'truncated': 'high', 'initials': 'high',
              'suffix': 'medium', 'shortened': 'medium', 'middle-name': 'medium',
              'reordered': 'medium', 'first-initial': 'medium', 'linked': 'medium',
              'surname-first': 'low', 'similar': 'low'}


def relation(a, b):
    """How two spellings are related, or None if they look like two people.

    Returns one of the CONFIDENCE keys:
      punctuation   same words; accents, case or punctuation differ
      truncated     the POS cut a word short: "Michae Connelly"
      shortened     a longer piece of a word is missing - a cut, or a nickname
      initials      a middle initial against the name it stands for: "Stephen G Jones"
      first-initial the given name cut to its initial: "S Moreno-Garcia". Weaker,
                    because an initial fits every name that starts with it -
                    "J. Vance" is as much Joyce Vance as J. D. Vance
      suffix        a Jr./M.D. one of them drops - and what tells a father from
                    a son ("Robert F. Kennedy", "Robert F. Kennedy Jr.")
      middle-name   one carries a middle name the other doesn't - which is also
                    what two different people with one name look like
      reordered     the POS's surname shuffle: "Bukowski Charles"
      surname-first the same, with a given name missing: "Marquez Garcia"
      similar       near-identical spellings, nothing above explains it
      linked        (merge_authors.py) reached through a third spelling, not
                    matched against this one directly
    """
    if a.raw == b.raw:
        return None
    if a.key == b.key:
        return 'punctuation'
    if a.bare == b.bare:
        return 'suffix'                                              # only a Jr./M.D. between them
    pa, pb = a.parts, b.parts
    if pa and pb:
        if pa[0] == pb[0] and pa[2] == pb[2]:                       # same given name and surname
            ma, mb = pa[1], pb[1]
            if ma and mb and len(ma) == len(mb) and all(_prefix_pair(x, y) for x, y in zip(ma, mb)):
                return 'initials'                                    # "J." against "Janet"
            if not ma or not mb:
                lone = (mb or ma)
                return 'initials' if all(len(w) == 1 for w in lone) else 'middle-name'
        if pa[2] == pb[2] and pa[1] == pb[1] and _prefix_pair(pa[0], pb[0]) and min(len(pa[0]), len(pb[0])) == 1:
            return 'first-initial'                                   # "S Moreno-Garcia" for Silvia
        if (rule := _truncation_rule((pa[0],) + pa[1] + pa[2], (pb[0],) + pb[1] + pb[2])):
            return rule
        if a.bag == b.bag:
            return 'reordered'
    if (rule := _truncation_rule(tokens(a.raw), tokens(b.raw))):
        return rule
    if pa and pb and _shuffled_subset(a, b):
        return 'surname-first'
    if similarity(a.raw, b.raw) >= SIMILAR_THRESHOLD and pa and pb:
        return 'similar'
    return None


# ---------------------------------------------------------------- the sorting surname

# set_author_last.py's own lists, kept as they were: author_last is what the
# site sorts and groups by, so this has to keep giving the same answer.
LAST_PARTICLES = {'van', 'von', 'le', 'la', 'de', 'du', 'del', 'der', 'di', 'da'}
LAST_SUFFIXES = {'jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'md', 'phd'}


def surname(author):
    """The surname the site files a book under - "Le Guin" for Ursula K. Le Guin."""
    first = re.split(r',| and | & | with ', author or '')[0].strip()
    parts = [p for p in first.split() if p.lower().strip(',') not in LAST_SUFFIXES]
    if not parts:
        return None
    last = [parts[-1]]
    while len(parts) - len(last) > 1 and parts[-len(last) - 1].lower() in LAST_PARTICLES:
        last.insert(0, parts[-len(last) - 1])
    return ' '.join(last)


# ---------------------------------------------------------------- canonical form

def canonical(counts, endorsed=()):
    """The spelling a cluster should file under: {spelling: book_count} in, one
    spelling out. `endorsed` are names Open Library uses for these books, which
    settle it when one of our spellings matches.

    How the name is written decides first. Accents and punctuation are what the
    POS drops and nothing puts back, so a spelling that still has them is the
    one off the cover however few copies we sold, and a spelling that is a
    cut-down copy of another is never the answer however many. Popularity
    settles everything the look of the name leaves open."""
    APOSTROPHES = "'" + chr(0x2019)
    ODD = re.compile('[^\\w\\s.,\\-' + APOSTROPHES + chr(0xc0) + '-' + chr(0x24f) + ']')

    backed = {Name(n).bare for n in endorsed}

    def cut_down(raw):
        mine = tokens(raw)
        return any(_cut(mine, tokens(other)) and len(''.join(mine)) < len(''.join(tokens(other)))
                   for other in counts if other != raw)

    def style(raw):
        letters = re.sub('[^A-Za-z]', '', raw)
        t = tokens(raw)
        s = 0
        if fold(raw) != raw.lower():
            s += 4                                           # Garc\u00eda, not Garcia
        s += sum(3 for w in t if len(w) == 1 and re.search(r'\b' + re.escape(w) + r'\.', raw, re.I))
        s += 2 * any(c in raw for c in APOSTROPHES)          # O'Dell
        if letters and letters != letters.upper():
            s += len(re.findall(r'\b[A-Z]{2,3}\b', raw))    # "TJ Klune", not "Tj Klune"
        exact = raw in endorsed                              # letter for letter what Open Library prints
        if letters and (letters.isupper() or letters.islower()) and not exact:
            s -= 8                                           # "JAMES PATTERSON", "james patterson"
        if ODD.search(raw):
            s -= 12                                          # a broken byte where a letter should be
        if exact:
            s += 12
        elif Name(raw).bare in backed:
            s += 10                                          # the same name, spelled our way
        elif cut_down(raw):
            s -= 12                                          # never file under a cut-off copy of another spelling
        name = Name(raw)
        if name.parts:
            s += 3                                           # a name we can parse beats a scrambled one
            if name.parts[2][-1] == t[-1]:
                s += 2                                       # surname last, as the site sorts
        return s

    return max(counts, key=lambda raw: (style(raw), counts[raw], len(tokens(raw)), -len(raw), raw))


# ---------------------------------------------------------------- applied merges


def recorded_merges(path=MANUAL_FIXES):
    """variant -> canonical, from the merges already applied (manual_fixes.json).
    Keyed by the folded spelling so punctuation can't smuggle one back in."""
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    return {k: v for k, v in (data.get(MERGE_KEY) or {}).items()}


def merge_lookup(path=MANUAL_FIXES):
    merges = recorded_merges(path)
    return {' '.join(tokens(k)): v for k, v in merges.items()}


def record_merges(pairs, path=MANUAL_FIXES):
    """Add variant -> canonical to manual_fixes.json, leaving every hand-checked
    book fix in it untouched."""
    data = json.loads(path.read_text()) if path.exists() else {}
    merges = dict(data.get(MERGE_KEY) or {})
    merges.update(pairs)
    data[MERGE_KEY] = dict(sorted(merges.items()))
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    return len(merges)


def canonical_author(raw, known, merges=None):
    """The spelling to file a newly imported book under.

    `known` is {spelling: book_count} for the authors already in the catalogue;
    `merges` the variant -> canonical map from manual_fixes.json. Only the rules
    that don't need a human eye are trusted here - anything less certain keeps
    the name it came with."""
    raw = (raw or '').strip()
    if not raw:
        return raw
    merges = merge_lookup() if merges is None else merges
    hit = merges.get(' '.join(tokens(raw)))
    if hit:
        return hit
    if raw in known:
        return raw
    mine = Name(raw)
    safe = {'punctuation', 'truncated', 'initials'}
    matches = {k: v for k, v in known.items() if relation(mine, Name(k)) in safe}
    if not matches:
        return raw
    return canonical({**matches, raw: known.get(raw, 0)})
