import React from 'react';
import { Heart } from 'lucide-react';
import { useWishlist, type WishlistBook } from '@/app/context/WishlistContext';

/**
 * The heart. `icon` is the small round button that sits on a cover; the
 * default is a labelled button for detail views.
 */
export const WishlistButton = ({ book, icon = false, className = '' }: { book: WishlistBook; icon?: boolean; className?: string }) => {
  const { has, toggle } = useWishlist();
  const saved = has(book.isbn);
  const label = saved ? 'Remove from wishlist' : 'Save to wishlist';

  if (icon) {
    return (
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(book); }}
        aria-label={label}
        aria-pressed={saved}
        title={label}
        className={`p-2 rounded-full shadow-md backdrop-blur-md transition-colors ${
          saved ? 'bg-white text-red-500' : 'bg-white/85 text-primary hover:text-red-500'
        } ${className}`}
      >
        <Heart size={16} className={saved ? 'fill-current' : ''} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggle(book)}
      aria-pressed={saved}
      className={`inline-flex items-center gap-2 text-sm font-bold transition-colors ${saved ? 'text-red-500' : 'text-primary hover:text-red-500'} ${className}`}
    >
      <Heart size={18} className={saved ? 'fill-current' : ''} />
      <span>{saved ? 'In your wishlist' : 'Save to wishlist'}</span>
    </button>
  );
};
