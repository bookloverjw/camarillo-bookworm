import React, { useEffect, useRef } from 'react';
import { BOOKSHOP_AFFILIATE_ID } from '@/lib/bookshopWidgets';

type WidgetType = 'book_button' | 'book' | 'featured' | 'list' | 'search';

interface BookshopWidgetProps {
  type: WidgetType;
  isbn?: string;
  listSlug?: string;
  includeBranding?: boolean;
  fullInfo?: boolean;
  className?: string;
}

/**
 * BookshopWidget - Embeds official Bookshop.org widgets
 *
 * Widget Types:
 * - book_button: Simple "Buy on Bookshop" button
 * - book: Book card with cover, price, store name, and buy button
 * - featured: Large featured book display with prominent buy button
 * - list: Carousel of books from a curated Bookshop list
 * - search: Search box that directs to Bookshop with affiliate credit
 */
export const BookshopWidget: React.FC<BookshopWidgetProps> = ({
  type,
  isbn,
  listSlug,
  includeBranding = false,
  fullInfo = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous content
    containerRef.current.innerHTML = '';

    // Create the script element
    const script = document.createElement('script');
    script.src = 'https://bookshop.org/widgets.js';
    script.setAttribute('data-type', type);
    script.setAttribute('data-affiliate-id', BOOKSHOP_AFFILIATE_ID);

    // Add type-specific attributes
    switch (type) {
      case 'book_button':
      case 'book':
        if (isbn) {
          script.setAttribute('data-sku', isbn);
        }
        break;

      case 'featured':
        if (isbn) {
          script.setAttribute('data-sku', isbn);
          script.setAttribute('data-full-info', String(fullInfo));
        }
        break;

      case 'list':
        if (listSlug) {
          script.setAttribute('data-list-slug', listSlug);
        }
        break;

      case 'search':
        script.setAttribute('data-include-branding', String(includeBranding));
        break;
    }

    containerRef.current.appendChild(script);

    // Cleanup on unmount
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [type, isbn, listSlug, includeBranding, fullInfo]);

  return <div ref={containerRef} className={className} />;
};

/**
 * BookshopBuyButton - Simplified component for just the buy button
 */
export const BookshopBuyButton: React.FC<{ isbn: string; className?: string }> = ({
  isbn,
  className = '',
}) => {
  return <BookshopWidget type="book_button" isbn={isbn} className={className} />;
};

/**
 * BookshopSearchBox - Search widget component
 */
export const BookshopSearchBox: React.FC<{
  includeBranding?: boolean;
  className?: string;
}> = ({ includeBranding = false, className = '' }) => {
  return (
    <BookshopWidget
      type="search"
      includeBranding={includeBranding}
      className={className}
    />
  );
};

/**
 * BookshopBookCard - Book card with cover and details
 */
export const BookshopBookCard: React.FC<{ isbn: string; className?: string }> = ({
  isbn,
  className = '',
}) => {
  return <BookshopWidget type="book" isbn={isbn} className={className} />;
};

/**
 * BookshopFeaturedBook - Large featured book display
 */
export const BookshopFeaturedBook: React.FC<{
  isbn: string;
  fullInfo?: boolean;
  className?: string;
}> = ({ isbn, fullInfo = true, className = '' }) => {
  return (
    <BookshopWidget type="featured" isbn={isbn} fullInfo={fullInfo} className={className} />
  );
};

/**
 * BookshopListCarousel - Carousel of books from a curated list
 */
export const BookshopListCarousel: React.FC<{
  listSlug: string;
  className?: string;
}> = ({ listSlug, className = '' }) => {
  return <BookshopWidget type="list" listSlug={listSlug} className={className} />;
};

export default BookshopWidget;
