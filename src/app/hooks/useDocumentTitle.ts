import { useEffect } from 'react';
import { formatTitle } from '@/lib/pageTitle';

// For pages whose title depends on loaded data (a book's name, say). Pass null
// while loading - the route's generic title from pageTitle.ts stays up until
// there is something better to show.
export function useDocumentTitle(pageTitle: string | null) {
  useEffect(() => {
    if (pageTitle) document.title = formatTitle(pageTitle);
  }, [pageTitle]);
}
