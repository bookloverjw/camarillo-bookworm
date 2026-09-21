// Per-page <head> metadata: description, canonical URL, Open Graph / Twitter
// tags, and JSON-LD. Titles are handled alongside in pageTitle.ts.
//
// The static public routes also get these baked into their own HTML files at
// build time (scripts/prerender-head.mjs) for crawlers that don't run
// JavaScript - link previews on Facebook, iMessage, and so on.
import routeMeta from '@/lib/routeMeta.json';

export const SITE_URL = 'https://www.camarillobookworm.com';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

const META: Record<string, { title: string; description: string }> = routeMeta;
const DEFAULT_DESCRIPTION = META['/'].description;

// Signed-in and checkout pages have nothing for a search engine.
const NOINDEX_PREFIXES = ['/account', '/login', '/cart', '/checkout'];

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

export function descriptionForPath(pathname: string) {
  return META[pathname]?.description ?? DEFAULT_DESCRIPTION;
}

/** Trim to a search-result-sized snippet on a word boundary. */
export function snippet(text: string, max = 160) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, clean.lastIndexOf(' ', max - 1)).replace(/[,;:.\s]+$/, '') + '…';
}

export function applySeo(opts: { title: string; description: string; path: string; image?: string }) {
  const url = `${SITE_URL}${opts.path === '/' ? '/' : opts.path.replace(/\/$/, '')}`;
  const image = opts.image || DEFAULT_OG_IMAGE;

  setMeta('name', 'description', opts.description);
  setMeta('property', 'og:title', opts.title);
  setMeta('property', 'og:description', opts.description);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:image', image);
  setMeta('name', 'twitter:title', opts.title);
  setMeta('name', 'twitter:description', opts.description);
  setMeta('name', 'twitter:image', image);
  setMeta('name', 'robots', NOINDEX_PREFIXES.some((p) => opts.path.startsWith(p)) ? 'noindex' : 'index, follow');

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = url;
}

/**
 * Put a JSON-LD block in the head under a stable id, replacing the last one.
 * Pass null to remove it (when leaving the page).
 */
export function setJsonLd(id: string, data: object | null) {
  const existing = document.getElementById(id);
  if (!data) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.createElement('script');
  el.id = id;
  el.setAttribute('type', 'application/ld+json');
  el.textContent = JSON.stringify(data);
  if (!existing) document.head.appendChild(el);
}
