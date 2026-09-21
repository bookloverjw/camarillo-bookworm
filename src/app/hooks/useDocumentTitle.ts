import { useEffect } from 'react';
import { formatTitle } from '@/lib/pageTitle';
import { applySeo, descriptionForPath } from '@/lib/seo';

// For pages whose title depends on loaded data (a book's name, say). Pass null
// while loading - the route's generic title from pageTitle.ts stays up until
// there is something better to show. A description and image, when given,
// replace the route's generic ones in the head metadata too.
export function useDocumentTitle(pageTitle: string | null, description?: string | null, image?: string | null) {
  useEffect(() => {
    if (!pageTitle) return;
    document.title = formatTitle(pageTitle);
    const path = window.location.pathname;
    applySeo({
      title: document.title,
      description: description || descriptionForPath(path),
      path,
      image: image || undefined,
    });
  }, [pageTitle, description, image]);
}
