// Google Analytics 4 helpers.
//
// The gtag.js snippet in index.html configures GA with send_page_view: false
// because this app uses HashRouter - every route lives in the URL fragment
// (/#/shop), and GA4 both misses in-app navigation and strips the fragment
// from page_location, so everything would land on "/" as a single pageview.
// trackPageView() below sends the pageviews instead, including the first one.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackPageView(path: string, search = '') {
  if (typeof window.gtag !== 'function') return;

  // Fold the hash route into a conventional path so GA4 reports read as
  // /shop instead of /#/shop.
  window.gtag('event', 'page_view', {
    page_location: `${window.location.origin}${path}${search}`,
    page_title: document.title,
  });
}
