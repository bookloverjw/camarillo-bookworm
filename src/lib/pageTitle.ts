import { STORE } from '@/lib/storeConfig';
import routeMeta from '@/lib/routeMeta.json';

// Document titles per route. Keep in sync with the <Routes> in App.tsx.
// The public, indexable pages live in routeMeta.json (with their descriptions)
// so the build-time prerender can read them too; the rest are listed here.
// Dynamic routes (/book/:id) fall back to the generic entry here and are
// refined by the page itself once its data loads - see useDocumentTitle.
const TITLES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(routeMeta).map(([path, meta]) => [path, meta.title])),
  '/book': 'Book Details',
  '/cart': 'Your Cart',
  '/checkout': 'Checkout',
  '/login': 'Sign In',
  '/account': 'Your Account',
  '/account/wishlist': 'Your Wishlist',
  '/account/orders': 'Order History',
  '/account/addresses': 'Saved Addresses',
  '/account/payments': 'Payment Methods',
  '/account/notifications': 'Notification Settings',
  '/account/settings': 'Account Settings',
};

export function formatTitle(pageTitle: string) {
  return `${pageTitle} | ${STORE.name}`;
}

export function titleForPath(pathname: string) {
  const exact = TITLES[pathname];
  if (exact) return formatTitle(exact);

  // /book/123 -> the /book entry; /account/anything-unlisted -> /account
  const parent = TITLES[`/${pathname.split('/')[1]}`];

  return parent ? formatTitle(parent) : STORE.name;
}
