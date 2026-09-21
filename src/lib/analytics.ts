// Google Analytics 4 helpers.
//
// The gtag.js snippet in index.html configures GA with send_page_view: false
// because this is a single-page app: trackPageView() below sends a pageview
// on every route change instead, including the first one, once the page's
// title is set.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackPageView(path: string, search = '') {
  if (typeof window.gtag !== 'function') return;

  window.gtag('event', 'page_view', {
    page_location: `${window.location.origin}${path}${search}`,
    page_title: document.title,
  });
}
