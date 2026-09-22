import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';

/**
 * The signed-in reader's wishlist, shared by every heart button on the site.
 *
 * One list per customer ("My Wishlist"), created the first time they save a
 * book. Items are keyed by ISBN, so any book can be saved - one from our
 * catalogue, or a best seller or award winner we don't carry (the wishlist
 * page sends those to Bookshop.org). The membership set is loaded once at
 * sign-in so every card can show the right heart without its own query.
 */
export interface WishlistBook {
  isbn: string;
  title: string;
  author: string;
  cover?: string | null;
  price?: number | null;
}

export interface WishlistEntry extends WishlistBook {
  id: string;
  added_at: string;
}

interface WishlistContextType {
  items: WishlistEntry[];
  isLoaded: boolean;
  has: (isbn?: string | null) => boolean;
  toggle: (book: WishlistBook) => Promise<void>;
  remove: (isbn: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const LIST_NAME = 'My Wishlist';

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [listId, setListId] = useState<string | null>(null);
  const [items, setItems] = useState<WishlistEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load the list whenever the signed-in user changes
  useEffect(() => {
    let cancelled = false;
    setListId(null);
    setItems([]);
    setIsLoaded(false);
    if (!user) { setIsLoaded(true); return; }
    (async () => {
      const { data: list } = await supabase
        .from('wishlists').select('id').eq('customer_id', user.id).eq('name', LIST_NAME).maybeSingle();
      if (cancelled) return;
      if (list) {
        setListId(list.id);
        const { data } = await supabase
          .from('wishlist_items').select('id,isbn,title,author,cover_url,price,added_at')
          .eq('wishlist_id', list.id).order('added_at', { ascending: false });
        if (cancelled) return;
        setItems((data ?? []).map(r => ({ id: r.id, isbn: r.isbn, title: r.title, author: r.author, cover: r.cover_url, price: r.price, added_at: r.added_at })));
      }
      setIsLoaded(true);
    })().catch(() => { if (!cancelled) setIsLoaded(true); });
    return () => { cancelled = true; };
  }, [user]);

  const isbns = useMemo(() => new Set(items.map(i => i.isbn)), [items]);
  const has = useCallback((isbn?: string | null) => !!isbn && isbns.has(isbn), [isbns]);

  /** The customer's list, created on first use. */
  const ensureList = useCallback(async () => {
    if (listId) return listId;
    const { data, error } = await supabase
      .from('wishlists')
      .insert({ customer_id: user!.id, name: LIST_NAME, is_public: false })
      .select('id').single();
    if (error) throw error;
    setListId(data.id);
    return data.id as string;
  }, [listId, user]);

  const remove = useCallback(async (isbn: string) => {
    const entry = items.find(i => i.isbn === isbn);
    if (!entry) return;
    setItems(prev => prev.filter(i => i.isbn !== isbn));
    const { error } = await supabase.from('wishlist_items').delete().eq('id', entry.id);
    if (error) {
      setItems(prev => [entry, ...prev]);
      toast.error("Couldn't update your wishlist. Please try again.");
    }
  }, [items]);

  const toggle = useCallback(async (book: WishlistBook) => {
    if (!user) {
      toast('Sign in to save books to your wishlist', {
        action: { label: 'Sign in', onClick: () => navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`) },
      });
      return;
    }
    if (!book.isbn) { toast.error("This book can't be saved yet."); return; }
    if (isbns.has(book.isbn)) { await remove(book.isbn); return; }
    try {
      const id = await ensureList();
      const { data, error } = await supabase.from('wishlist_items')
        .insert({ wishlist_id: id, isbn: book.isbn, title: book.title, author: book.author, cover_url: book.cover ?? null, price: book.price ?? null })
        .select('id,added_at').single();
      if (error && error.code !== '23505') throw error;
      if (data) setItems(prev => [{ ...book, id: data.id, added_at: data.added_at }, ...prev]);
      toast.success('Saved to your wishlist', {
        action: { label: 'View', onClick: () => navigate('/account/wishlist') },
      });
    } catch (err) {
      console.error('Wishlist error:', err);
      toast.error("Couldn't save that. Please try again.");
    }
  }, [user, isbns, remove, ensureList, navigate, location.pathname]);

  return (
    <WishlistContext.Provider value={{ items, isLoaded, has, toggle, remove }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider');
  return ctx;
};
