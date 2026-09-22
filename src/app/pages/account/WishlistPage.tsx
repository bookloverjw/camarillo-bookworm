import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Grid, List as ListIcon, Heart, ExternalLink, Loader2 } from 'lucide-react';
import { Link } from 'react-router';
import { BookCover } from '@/app/components/BookCover';
import { useWishlist } from '@/app/context/WishlistContext';
import { useBookModal } from '@/app/context/BookModalContext';
import { getBookshopAffiliateUrl } from '@/app/context/CartContext';
import { getBookByIsbn } from '@/lib/bookService';

/**
 * The reader's saved books. Items are stored by ISBN, so a saved book may or
 * may not be one we carry: opening it looks the ISBN up in the catalogue and
 * shows our own quick view when it's there, the Bookshop.org one when not.
 */
export const WishlistPage = () => {
  const { items, isLoaded, remove } = useWishlist();
  const { openModal, openExternal } = useBookModal();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const open = async (item: (typeof items)[number]) => {
    const ours = await getBookByIsbn(item.isbn).catch(() => null);
    if (ours) openModal(ours.id);
    else openExternal({ title: item.title, author: item.author, isbn: item.isbn, cover: item.cover, price: item.price });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-primary mb-2">My Wishlist</h2>
          <p className="text-muted-foreground">Books you've saved - tap the heart on any book to add it here.</p>
        </div>
        <div className="flex items-center bg-muted rounded-xl p-1 border border-border self-start">
          <button onClick={() => setViewMode('grid')} aria-label="Grid view" className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}><Grid size={16} /></button>
          <button onClick={() => setViewMode('list')} aria-label="List view" className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}><ListIcon size={16} /></button>
        </div>
      </div>

      {!isLoaded && (
        <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground"><Loader2 className="animate-spin text-primary" size={24} /> Loading your wishlist…</div>
      )}

      {isLoaded && items.length > 0 && (
        <div className={`grid ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6' : 'grid-cols-1 gap-4'}`}>
          <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`group bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-all ${viewMode === 'list' ? 'flex items-center p-4 gap-5' : 'flex flex-col'}`}
              >
                <button onClick={() => open(item)} className={`relative block text-left ${viewMode === 'list' ? 'w-20 h-28 shrink-0' : 'aspect-[2/3] m-4 mb-0'}`}>
                  <BookCover src={item.cover} isbn={item.isbn} title={item.title} author={item.author} className="w-full h-full object-contain rounded-lg" />
                </button>
                <div className={`flex-1 flex flex-col ${viewMode === 'list' ? '' : 'p-4'}`}>
                  <button onClick={() => open(item)} className="text-left">
                    <h3 className="font-serif font-bold text-primary leading-tight line-clamp-2 hover:text-accent transition-colors">{item.title}</h3>
                  </button>
                  <p className="text-xs text-muted-foreground italic mt-1 mb-3">by {item.author}</p>
                  <div className="mt-auto flex items-center gap-3">
                    <a href={getBookshopAffiliateUrl(item.isbn)} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors">
                      <ExternalLink size={12} /> Order
                    </a>
                    <button onClick={() => remove(item.isbn)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors" aria-label={`Remove ${item.title} from wishlist`}>
                      <X size={14} /> Remove
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {isLoaded && items.length === 0 && (
        <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
          <Heart size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-xl font-serif font-bold text-primary mb-2">Your wishlist is empty</h3>
          <p className="text-muted-foreground mb-8">Tap the heart on any book to save it for later.</p>
          <Link to="/shop" className="bg-primary text-white px-8 py-3 rounded-full font-bold">Browse the shop</Link>
        </div>
      )}
    </div>
  );
};
