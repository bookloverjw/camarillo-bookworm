/**
 * Shared plumbing for the ISBNdb jobs (list prices, Coming Soon).
 *
 * Both run on a schedule in GitHub Actions (.github/workflows/isbndb-refresh.yml)
 * and can be run by hand. They need two secrets in the environment - never
 * commit either:
 *   ISBNDB_API_KEY       isbndb.com > account > API key
 *   SUPABASE_SECRET_KEY  Supabase dashboard > Settings > API > Secret keys
 */

export const SUPABASE_URL = 'https://lildbdxabljkoynvpflu.supabase.co';
const ISBNDB = 'https://api2.isbndb.com';

export function requireEnv(...names) {
  const missing = names.filter(n => !process.env[n]);
  if (missing.length) {
    console.error(`Missing ${missing.join(', ')}. See the header of scripts/isbndb/lib.mjs.`);
    process.exit(1);
  }
}

export const args = process.argv.slice(2);
export const flag = name => args.includes(`--${name}`);
export const option = (name, fallback) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Thrown when ISBNdb says today's allowance is spent: stop cleanly, try tomorrow. */
export class QuotaExhausted extends Error {}

export async function isbndb(path, { method = 'GET', body } = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${ISBNDB}${path}`, {
      method,
      headers: {
        Authorization: process.env.ISBNDB_API_KEY,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404) return null;                      // not in ISBNdb
    if (res.status === 429) {
      const text = await res.text();
      if (/daily/i.test(text)) throw new QuotaExhausted(text);
      if (attempt >= 4) throw new Error(`ISBNdb rate limit: ${text}`);
      await sleep(15000 * attempt);                           // per-minute limit: wait it out
      continue;
    }
    if (res.status >= 500 && attempt < 3) { await sleep(5000 * attempt); continue; }
    if (!res.ok) throw new Error(`ISBNdb ${method} ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  }
}

/** Calls left today, from GET /key - which doesn't itself count against the quota. */
export async function callsLeftToday() {
  const key = await isbndb('/key');
  const limit = key?.plan_limit ?? {};
  return { plan: key?.plan_name ?? 'unknown', left: limit.key_left ?? limit.left ?? 0, total: limit.total ?? 0 };
}

export async function supabase(path, { method = 'GET', body, prefer } = {}) {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path.split('?')[0]}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Append a Markdown section to the GitHub Actions run summary, when there is one. */
export async function summary(markdown) {
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  }
}
