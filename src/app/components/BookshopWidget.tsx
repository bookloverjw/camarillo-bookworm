import React, { useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { BOOKSHOP_AFFILIATE_ID, getBookshopBookUrl, getBookshopSearchUrl, getBookshopStorefrontUrl } from '@/lib/bookshopWidgets';

/**
 * BookshopBuyButton - Styled button that links to Bookshop.org
 * Uses direct links instead of embedded widgets to avoid Cloudflare challenges
 */
export const BookshopBuyButton: React.FC<{ isbn: string; className?: string }> = ({
  isbn,
  className = '',
}) => {
  const url = getBookshopBookUrl(isbn);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center space-x-2 bg-[#EF4056] text-white px-6 py-3 rounded-full font-medium hover:bg-[#d63347] transition-colors ${className}`}
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
      <span>BUY ON BOOKSHOP</span>
    </a>
  );
};

/**
 * BookshopSearchBox - Search form that directs to Bookshop.org with affiliate credit
 */
export const BookshopSearchBox: React.FC<{
  includeBranding?: boolean;
  className?: string;
}> = ({ includeBranding = false, className = '' }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.open(getBookshopSearchUrl(query), '_blank');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="flex items-center bg-white border-2 border-gray-200 rounded-full overflow-hidden shadow-sm hover:border-[#EF4056]/50 transition-colors">
        <div className="pl-4 text-gray-400">
          <Search size={20} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search books on Bookshop.org..."
          className="flex-1 px-4 py-3 outline-none text-gray-800 placeholder:text-gray-400"
        />
        <button
          type="submit"
          className="bg-[#EF4056] text-white px-6 py-3 font-medium hover:bg-[#d63347] transition-colors"
        >
          SEARCH
        </button>
      </div>
      {includeBranding && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Powered by <a href={getBookshopStorefrontUrl()} target="_blank" rel="noopener noreferrer" className="text-[#EF4056] hover:underline">Bookshop.org</a>
        </p>
      )}
    </form>
  );
};

/**
 * BookshopBookCard - Simple book card with link to Bookshop
 */
export const BookshopBookCard: React.FC<{
  isbn: string;
  title?: string;
  author?: string;
  coverUrl?: string;
  price?: number;
  className?: string;
}> = ({ isbn, title, author, coverUrl, price, className = '' }) => {
  const url = getBookshopBookUrl(isbn);

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      {coverUrl && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={coverUrl} alt={title} className="w-full aspect-[2/3] object-cover rounded mb-3" />
        </a>
      )}
      {title && <h4 className="font-medium text-gray-900 line-clamp-2">{title}</h4>}
      {author && <p className="text-sm text-gray-600">{author}</p>}
      {price && <p className="text-lg font-bold text-gray-900 mt-2">${price.toFixed(2)}</p>}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block w-full text-center bg-[#EF4056] text-white py-2 rounded font-medium hover:bg-[#d63347] transition-colors"
      >
        BUY THIS BOOK
      </a>
    </div>
  );
};

/**
 * BookshopFeaturedBook - Large featured book display
 */
export const BookshopFeaturedBook: React.FC<{
  isbn: string;
  title?: string;
  author?: string;
  coverUrl?: string;
  className?: string;
}> = ({ isbn, title, author, coverUrl, className = '' }) => {
  const url = getBookshopBookUrl(isbn);

  return (
    <div className={`text-center ${className}`}>
      {coverUrl && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block">
          <img
            src={coverUrl}
            alt={title}
            className="max-w-xs mx-auto shadow-xl rounded border-4 border-[#EF4056] hover:scale-105 transition-transform"
          />
        </a>
      )}
      {title && <h3 className="text-xl font-bold text-gray-900 mt-4">{title}</h3>}
      {author && <p className="text-gray-600">{author}</p>}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center justify-center space-x-2 bg-[#EF4056] text-white px-8 py-3 rounded-full font-medium hover:bg-[#d63347] transition-colors"
      >
        <span>BUY ON BOOKSHOP.ORG</span>
        <ExternalLink size={16} />
      </a>
      <p className="text-xs text-gray-500 mt-2">Support Local Bookstores</p>
    </div>
  );
};

/**
 * BookshopStorefrontLink - Link to the store's Bookshop storefront
 */
export const BookshopStorefrontLink: React.FC<{
  className?: string;
  children?: React.ReactNode;
}> = ({ className = '', children }) => {
  return (
    <a
      href={getBookshopStorefrontUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center space-x-2 text-[#EF4056] hover:underline ${className}`}
    >
      {children || (
        <>
          <span>Browse our Bookshop.org store</span>
          <ExternalLink size={14} />
        </>
      )}
    </a>
  );
};

export default BookshopBuyButton;
