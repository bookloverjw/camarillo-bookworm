import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart } from 'lucide-react';
import { BookCover } from '@/app/components/BookCover';
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

// The book someone tapped the heart on before signing in, saved for them
// once they have. Session storage, wrapped: it can be blocked or full.
const PENDING_KEY = 'wishlist:pending';
const stash = (book: WishlistBook | null) => {
  try { book ? sessionStorage.setItem(PENDING_KEY, JSON.stringify(book)) : sessionStorage.removeItem(PENDING_KEY); } catch { /* storage unavailable */ }
};
const takeStash = (): WishlistBook | null => {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as WishlistBook;
  } catch { return null; }
};

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [listId, setListId] = useState<string | null>(null);
  const [items, setItems] = useState<WishlistEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<WishlistBook | null>(null);
  // The book a signed-out reader tried to save: shown in the sign-in prompt
  const [prompt, setPrompt] = useState<WishlistBook | null>(null);

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
      // Finish what they started before signing in
      const pending = takeStash();
      if (pending) setPendingAdd(pending);
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
      // Timestamps set here: the table doesn't fill them in itself.
      .insert({ customer_id: user!.id, name: LIST_NAME, is_public: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
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
      stash(book);
      setPrompt(book);
      return;
    }
    if (!book.isbn) { toast.error("This book can't be saved yet."); return; }
    if (isbns.has(book.isbn)) { await remove(book.isbn); return; }
    try {
      const id = await ensureList();
      const { data, error } = await supabase.from('wishlist_items')
        .insert({ wishlist_id: id, isbn: book.isbn, title: book.title, author: book.author, cover_url: book.cover ?? null, price: book.price ?? null, added_at: new Date().toISOString() })
        .select('id,added_at').single();
      if (error && error.code !== '23505') throw error;
      if (data) setItems(prev => [{ ...book, id: data.id, added_at: data.added_at }, ...prev]);
      toast.success('Saved to your wishlist', {
        action: { label: 'View', onClick: () => navigate('/account/wishlist') },
      });
    } catch (err) {
      console.error('Wishlist error:', err);
      const detail = (err as { message?: string })?.message;
      toast.error("Couldn't save that. Please try again.", detail ? { description: detail } : undefined);
    }
  }, [user, isbns, remove, ensureList, navigate, location.pathname]);

  // Runs once the list is loaded and toggle has the fresh membership set
  useEffect(() => {
    if (!pendingAdd || !isLoaded || !user) return;
    setPendingAdd(null);
    if (!isbns.has(pendingAdd.isbn)) toggle(pendingAdd);
  }, [pendingAdd, isLoaded, user, isbns, toggle]);

  const goSignIn = (mode?: 'signup') => {
    setPrompt(null);
    const redirect = encodeURIComponent(location.pathname + location.search);
    navigate(`/login?redirect=${redirect}${mode ? '&mode=signup' : ''}`);
  };

  return (
    <WishlistContext.Provider value={{ items, isLoaded, has, toggle, remove }}>
      {children}
      <AnimatePresence>
        {prompt && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-6"
            onClick={() => setPrompt(null)}
            role="dialog" aria-modal="true" aria-label="Sign in to save to your wishlist"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-background shadow-2xl p-6 sm:p-8"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setPrompt(null)} aria-label="Close" className="absolute top-3 right-3 p-2 rounded-full hover:bg-muted"><X size={18} /></button>
              <div className="flex gap-5 items-start">
                <div className="w-20 shrink-0 aspect-[2/3] rounded-lg overflow-hidden shadow-md bg-muted/30">
                  <BookCover src={prompt.cover} isbn={prompt.isbn} title={prompt.title} author={prompt.author} className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-500 mb-2"><Heart size={12} className="fill-current" /> Wishlist</p>
                  <h2 className="text-xl font-serif font-bold text-primary leading-tight">Save <span className="italic">{prompt.title}</span> for later?</h2>
                  <p className="text-sm text-muted-foreground mt-2">Sign in and we'll add it to your wishlist. Your list follows you between visits and devices.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button onClick={() => goSignIn()} className="flex-1 px-5 py-3 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors">Sign in</button>
                <button onClick={() => goSignIn('signup')} className="flex-1 px-5 py-3 border-2 border-primary text-primary rounded-lg text-sm font-bold hover:bg-primary hover:text-white transition-colors">Create an account</button>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-4">Free, and takes a minute.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider');
  return ctx;
};
