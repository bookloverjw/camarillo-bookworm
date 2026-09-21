import { STORE } from '@/lib/storeConfig';

// Document titles per route. Keep in sync with the <Routes> in App.tsx.
// Dynamic routes (/book/:id) fall back to the generic entry here and are
// refined by the page itself once its data loads - see useDocumentTitle.
const TITLES: Record<string, string> = {
  '/': 'Independent Bookstore Since 1973',
  '/shop': 'Shop Books',
  '/book': 'Book Details',
  '/events': 'Author Events & Book Clubs',
  '/staff-picks': 'Staff Picks',
  '/gift-cards': 'Gift Cards',
  '/about': 'About Us',
  '/read-alikes': 'Read-Alikes',
  '/collections': 'Collections',
  '/contact': 'Contact & Hours',
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
