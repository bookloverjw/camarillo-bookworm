#!/usr/bin/env python3
"""Write the proposed catalogue fixes (propose_fixes.py) to the database.

  SUPABASE_SECRET_KEY=... python3 scripts/catalog/apply_fixes.py --dry-run
  SUPABASE_SECRET_KEY=... python3 scripts/catalog/apply_fixes.py [--only author,title,category]
  SUPABASE_SECRET_KEY=... python3 scripts/catalog/apply_fixes.py --undo .cache/undo-<time>.json

Before writing, it saves every current value to .cache/undo-<time>.json so
the whole run can be reversed with --undo.
"""
import argparse, json, time, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from catalog import CACHE, SUPABASE_URL, http, secret_key, write_headers


def patch(key, book_id, values):
    url = f"{SUPABASE_URL}/rest/v1/books?id=eq.{urllib.parse.quote(book_id)}"
    http(url, data=json.dumps(values).encode(), headers=write_headers(key), method='PATCH')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--only', help='comma-separated fields: author,title,category')
    ap.add_argument('--undo', help='an undo file from an earlier run')
    args = ap.parse_args()
    key = secret_key()

    if args.undo:
        changes = [(r['id'], r['old']) for r in json.loads(open(args.undo).read())]
    else:
        fields = set(args.only.split(',')) if args.only else {'author', 'title', 'category'}
        fixes = json.loads((CACHE / 'fixes.json').read_text())
        changes = []
        for f in fixes:
            new = {k: v for k, v in f['new'].items() if k in fields}
            if new:
                changes.append((f['id'], new, {k: f['old'][k] for k in new}))
        undo = CACHE / f"undo-{time.strftime('%Y%m%d-%H%M%S')}.json"
        if not args.dry_run:
            undo.write_text(json.dumps([{'id': i, 'old': old} for i, _, old in changes], ensure_ascii=False))
            print(f'saved current values to {undo}')
        changes = [(i, new) for i, new, _ in changes]

    print(f"{'would update' if args.dry_run else 'updating'} {len(changes)} books")
    if args.dry_run:
        for i, v in changes[:15]:
            print(f'  {i}: {v}')
        return
    done = failed = 0
    def one(c):
        try:
            patch(key, *c)
            return True
        except Exception as e:
            print(f'  {c[0]}: {e}')
            return False
    with ThreadPoolExecutor(max_workers=6) as pool:
        for ok in pool.map(one, changes):
            done += ok
            failed += not ok
            if (done + failed) % 500 == 0:
                print(f'  {done + failed}/{len(changes)}')
    print(f'done: {done} updated, {failed} failed')


if __name__ == '__main__':
    main()
