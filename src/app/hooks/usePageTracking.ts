import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { trackPageView } from '@/lib/analytics';
import { titleForPath } from '@/lib/pageTitle';
import { applySeo, descriptionForPath } from '@/lib/seo';

// Sets the document title and head metadata, and sends a GA4 page_view, on
// every route change. Must be rendered inside the router - see
// AnalyticsTracker in App.tsx.
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    // Title first, so the page_view below reports the new page, not the old one.
    document.title = titleForPath(location.pathname);
    applySeo({
      title: document.title,
      description: descriptionForPath(location.pathname),
      path: location.pathname,
    });
    trackPageView(location.pathname, location.search);
  }, [location.pathname, location.search]);
}
