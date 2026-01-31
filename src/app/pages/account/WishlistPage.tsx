import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, X, Share2, Grid, List as ListIcon, Search, BellRing, BellOff } from 'lucide-react';
import { BOOKS } from '@/app/utils/data';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { Link } from 'react-router';

export const WishlistPage = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [items, setItems] = useState(BOOKS.slice(0, 4).map(b => ({ ...b, notify: false })));

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const toggleNotify = (id: string) => {
    setItems(items.map(item => item.id === id ? { ...item, notify: !item.notify } : item));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-primary mb-2">My Wishlist</h2>
          <p className="text-muted-foreground">Keep track of the books you want to read next.</p>
        </div>
        <div className="flex items-center space-x-4">
          <button className="flex items-center space-x-2 text-sm font-bold text-accent hover:underline px-4 py-2">
            <Share2 size={16} />
            <span>Share List</span>
          </button>
          <div className="flex items-center bg-muted rounded-xl p-1 border border-border">
            <button 
              onClick={() => setViewMode('grid')} 
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
            >
              <Grid size={16} />
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6' : 'grid-cols-1 gap-4'}`}>
        <AnimatePresence>
          {items.map((book) => (
            <motion.div
              key={book.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, x: -20 }}
              className={`group bg-white rounded-2xl border border-border overflow-hidden hover:shadow-xl transition-all ${viewMode === 'list' ? 'flex items-center p-4' : ''}`}
            >
              <div className={`relative ${viewMode === 'list' ? 'w-24 h-32 shrink-0' : 'aspect-[2/3]'}`}>
                <ImageWithFallback src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                <button 
                  onClick={() => removeItem(book.id)}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between h-full">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-serif font-bold text-primary leading-tight line-clamp-2">{book.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 italic">by {book.author}</p>
                  
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="text-lg font-bold text-primary">${book.price.toFixed(2)}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${book.status === 'In Stock' ? 'text-green-600' : 'text-orange-500'}`}>
                      {book.status === 'In Stock' ? '✓ In Stock' : '⚠️ Low Stock'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button className="flex items-center justify-center space-x-2 bg-primary text-white py-2.5 rounded-xl text-xs font-bold hover:bg-primary/90 transition-all">
                    <ShoppingBag size={14} />
                    <span>Add to Bag</span>
                  </button>
                  <button 
                    onClick={() => toggleNotify(book.id)}
                    className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                      book.notify 
                        ? 'bg-accent/10 border-accent text-accent' 
                        : 'border-border text-muted-foreground hover:border-primary/20'
                    }`}
                  >
                    {book.notify ? <BellRing size={14} /> : <BellOff size={14} />}
                    <span>{book.notify ? 'Notifications On' : 'Notify Me'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {items.length === 0 && (
        <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
          <Heart size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
          <h3 className="text-xl font-serif font-bold text-primary mb-2">Your wishlist is empty</h3>
          <p className="text-muted-foreground mb-8">Start adding books you love!</p>
          <Link to="/shop" className="bg-primary text-white px-8 py-3 rounded-full font-bold">Browse Shop</Link>
        </div>
      )}
    </div>
  );
};
