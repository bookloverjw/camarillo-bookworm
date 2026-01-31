// Bookshop.org Widget Integration for Camarillo Bookworm
// These widgets embed official Bookshop.org elements that support our store

export const BOOKSHOP_AFFILIATE_ID = 'camarillobookworm';

// Widget types available from Bookshop.org
export type BookshopWidgetType =
  | 'book_button'   // Simple "Buy on Bookshop" button
  | 'book'          // Book card with cover, price, and buy button
  | 'featured'      // Large featured book display
  | 'list'          // Carousel of books from a list
  | 'search';       // Search box that directs to Bookshop

// Generate a script tag for Bookshop widget (for SSR or dynamic insertion)
export function getBookshopWidgetScript(
  type: BookshopWidgetType,
  options: {
    isbn?: string;           // Required for book_button, book, featured
    listSlug?: string;       // Required for list widget
    includeBranding?: boolean; // For search widget
    fullInfo?: boolean;      // For featured widget
  } = {}
): string {
  const baseAttrs = `src="https://bookshop.org/widgets.js" data-type="${type}" data-affiliate-id="${BOOKSHOP_AFFILIATE_ID}"`;

  switch (type) {
    case 'book_button':
      return `<script ${baseAttrs} data-sku="${options.isbn}"></script>`;

    case 'book':
      return `<script ${baseAttrs} data-sku="${options.isbn}"></script>`;

    case 'featured':
      return `<script ${baseAttrs} data-full-info="${options.fullInfo ?? true}" data-sku="${options.isbn}"></script>`;

    case 'list':
      return `<script ${baseAttrs} data-list-slug="${options.listSlug}"></script>`;

    case 'search':
      return `<script ${baseAttrs} data-include-branding="${options.includeBranding ?? false}"></script>`;

    default:
      return '';
  }
}

// Direct affiliate link for a specific book by ISBN
export function getBookshopBookUrl(isbn: string): string {
  return `https://bookshop.org/a/${BOOKSHOP_AFFILIATE_ID}/${isbn}`;
}

// Link to the store's Bookshop storefront
export function getBookshopStorefrontUrl(): string {
  return `https://bookshop.org/shop/${BOOKSHOP_AFFILIATE_ID}`;
}

// Search URL with affiliate tracking
export function getBookshopSearchUrl(query: string): string {
  return `https://bookshop.org/search?keywords=${encodeURIComponent(query)}&affiliate=${BOOKSHOP_AFFILIATE_ID}`;
}

// Generate ISBN from book ID (for demo purposes)
// In production, you'd use real ISBNs from your database
export function generateDemoIsbn(bookId: string): string {
  // Real ISBNs are 13 digits starting with 978 or 979
  return `978${bookId.padStart(10, '0')}`;
}
