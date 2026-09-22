import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Phone, Store, Truck, Headphones, Loader2 } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { toast } from 'sonner';
import { BookCover } from '@/app/components/BookCover';
import { PhoneLink } from '@/app/components/PhoneLink';
import { BookAwards } from '@/app/components/AwardBadge';
import { CriticReviews } from '@/app/components/CriticReviews';
import { BookshopBuyNote } from '@/app/components/BookshopBuyNote';
import { WishlistButton } from '@/app/components/WishlistButton';
import { useBookModal, type ExternalBook } from '@/app/context/BookModalContext';
import { useCart, getBookshopAffiliateUrl } from '@/app/context/CartContext';
import { buysThroughBookshop } from '@/lib/features';
import { displayGenre } from '@/lib/genres';
import { stripHtmlTags } from '@/lib/stripHtml';
import { getBookshopSearchUrl, getGoodreadsUrl, getLibroFmUrl } from '@/lib/bookshopWidgets';
import { getBookById, getRecommendations } from '@/lib/bookService';
import type { Book } from '@/app/utils/data';

/**
 * The one quick view for every book on the site - a catalogue title, a best
 * seller we don't carry, an award winner, a forthcoming book. Same size and
 * shape whichever it is; only the offer changes: our own purchase options for
 * a catalogue book, Bookshop.org or a call for the rest.
 */
export const BookQuickView: React.FC = () => {
  const { view, closeModal, openModal } = useBookModal();
  const { addItem } = useCart();
  const [book, setBook] = useState<Book | null>(null);
  const [related, setRelated] = useState<Book[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'missing'>('idle');

  const catalogId = view?.catalogId;

  // Going anywhere - the sign-in page from the wishlist prompt, a full-details
  // link - means the quick view should be gone when you get there.
  const { pathname } = useLocation();
  useEffect(() => { closeModal(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load a catalogue book. Never spins forever: a lookup that fails or finds
  // nothing shows a way out (the full page, which has its own fallbacks).
  useEffect(() => {
    setBook(null);
    setRelated([]);
    if (!catalogId) { setState('idle'); return; }
    let cancelled = false;
    setState('loading');
    const timeout = setTimeout(() => { if (!cancelled) setState(s => (s === 'loading' ? 'missing' : s)); }, 12000);
    getBookById(catalogId)
      .then(async (fetched) => {
        if (cancelled) return;
        if (!fetched) { setState('missing'); return; }
        setBook(fetched);
        setState('ready');
        setRelated(await getRecommendations(fetched).catch(() => []));
      })
      .catch(() => { if (!cancelled) setState('missing'); })
      .finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [catalogId]);

  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeModal();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, closeModal]);

  const addToCart = async (deliveryOption: 'pickup' | 'ship') => {
    if (!book) return;
    const isbn = book.isbn || `978${book.id.padStart(10, '0')}`;
    const added = await addItem(
      { id: book.id, isbn, title: book.title, author: book.author, price: book.price, cover: book.cover, type: book.type, bookshopUrl: getBookshopAffiliateUrl(isbn) },
      1, deliveryOption,
    );
    if (added) toast.success(deliveryOption === 'pickup' ? `"${book.title}" added for in-store pickup!` : `"${book.title}" added to cart!`);
  };

  // What to show: the loaded catalogue book, or the external one as given
  const shown: ExternalBook | null = book
    ? { title: book.title, author: book.author, isbn: book.isbn, cover: book.cover, price: book.price, description: stripHtmlTags(book.description), note: displayGenre(book.category, book.genre) ?? book.category }
    : view?.book ?? null;

  const bookshopUrl = shown
    ? shown.isbn ? getBookshopAffiliateUrl(shown.isbn) : getBookshopSearchUrl(`${shown.title} ${shown.author}`)
    : '';

  return (
    <AnimatePresence>
      {view && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-6"
          onClick={closeModal}
          role="dialog" aria-modal="true" aria-label={shown?.title ?? 'Book details'}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={closeModal} aria-label="Close modal" className="absolute top-3 right-3 z-10 p-2 rounded-full bg-background/80 hover:bg-muted">
              <X size={20} />
            </button>

            {state === 'loading' && (
              <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground">
                <Loader2 className="animate-spin text-primary" size={24} /> Loading…
              </div>
            )}

            {state === 'missing' && catalogId && (
              <div className="p-10 text-center space-y-4">
                <h2 className="text-2xl font-serif font-bold text-primary">We couldn't load this book</h2>
                <p className="text-muted-foreground">It may have been removed from our catalogue, or the connection dropped.</p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Link to={`/book/${catalogId}`} onClick={closeModal} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90">Open the book's page</Link>
                  <button onClick={() => openModal(catalogId)} className="px-5 py-2.5 border border-border rounded-lg text-sm font-bold text-primary hover:bg-muted">Try again</button>
                </div>
                <p className="text-sm text-muted-foreground">Or call <PhoneLink /> and we'll look it up for you.</p>
              </div>
            )}

            {shown && state !== 'loading' && state !== 'missing' && (
              <>
                <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6">
                  <div className="w-40 sm:w-48 shrink-0 mx-auto sm:mx-0">
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg border border-border bg-muted/30">
                      <BookCover src={shown.cover} isbn={shown.isbn} title={shown.title} author={shown.author} className="w-full h-full object-contain" />
                      {shown.isbn && <WishlistButton icon book={shown} className="absolute top-2 right-2" />}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-4">
                    {shown.note && <p className="text-[11px] font-bold uppercase tracking-wider text-accent">{shown.note}</p>}
                    <div>
                      <h2 className="text-2xl font-serif font-bold text-primary leading-tight">{shown.title}</h2>
                      {book?.subtitle && <p className="text-muted-foreground font-serif leading-snug mt-1">{book.subtitle}</p>}
                      <p className="text-muted-foreground italic mt-1">by {shown.author}</p>
                    </div>
                    {shown.price != null && shown.price > 0 && (
                      <p className="text-xl font-bold text-primary">
                        ${shown.price.toFixed(2)}{!book && <span className="text-xs font-normal text-muted-foreground"> list price</span>}
                      </p>
                    )}
                    {shown.description && <p className="text-sm text-foreground/80 leading-relaxed line-clamp-6 whitespace-pre-line">{shown.description}</p>}

                    <BookAwards id={book?.id} isbn={shown.isbn} author={shown.author} title={shown.title} />

                    {book && (
                      <div className="flex gap-6 pt-3 border-t border-border text-sm">
                        <div><p className="text-muted-foreground">Format</p><p className="font-medium text-foreground">{book.type}</p></div>
                        <div><p className="text-muted-foreground">ISBN</p><p className="font-medium text-foreground">{book.isbn || 'N/A'}</p></div>
                      </div>
                    )}

                    {/* The offer */}
                    <div className="space-y-3 pt-2">
                      {book && !buysThroughBookshop(book.status) && book.status !== 'Preorder Closed' && book.status !== 'Unavailable' ? (
                        <div className="flex flex-wrap gap-3">
                          <button onClick={() => addToCart('pickup')} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors">
                            <Store size={16} /> In-Store Pickup
                          </button>
                          <button onClick={() => addToCart('ship')} className="flex items-center gap-2 px-5 py-2.5 border-2 border-primary text-primary rounded-lg text-sm font-bold hover:bg-primary hover:text-white transition-colors">
                            <Truck size={16} /> Ship to Me
                          </button>
                        </div>
                      ) : (
                        <>
                          <a href={bookshopUrl} target="_blank" rel="noopener noreferrer"
                             className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors">
                            <ExternalLink size={16} /> {shown.forthcoming ? 'Preorder on Bookshop.org' : 'Order on Bookshop.org'}
                          </a>
                          {book && <p className="text-xs text-muted-foreground text-center"><BookshopBuyNote status={book.status} /></p>}
                        </>
                      )}
                      <p className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Phone size={16} className="mt-0.5 shrink-0" />
                        <span>
                          {shown.forthcoming
                            ? <>Or call <PhoneLink /> and we'll reserve a copy for you.</>
                            : <>Or call <PhoneLink /> — we'll check our shelves, or order it in for you.</>}
                        </span>
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        {shown.isbn && <WishlistButton book={shown} />}
                        {book && (
                          <Link to={`/book/${book.id}`} onClick={closeModal} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                            <ExternalLink size={14} /> Full details
                          </Link>
                        )}
                        <a href={getGoodreadsUrl(shown)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                          <ExternalLink size={14} /> Goodreads
                        </a>
                        <a href={getLibroFmUrl(shown.title)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                          <Headphones size={14} /> Libro.fm
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Critic reviews, full width under the book - only if Book Marks has any */}
                <div className="px-6 sm:px-8 pb-6 empty:hidden">
                  <CriticReviews isbn={shown.isbn} compact />
                </div>

                {related.length > 0 && (
                  <div className="px-6 sm:px-8 pb-8">
                    <h3 className="text-base font-serif font-bold text-primary mb-4 pb-2 border-b border-border">You Might Also Like</h3>
                    <div className="grid grid-cols-4 gap-4">
                      {related.slice(0, 4).map(item => (
                        <button key={item.id} onClick={() => openModal(item.id)} className="group text-left">
                          <div className="aspect-[2/3] rounded-lg overflow-hidden shadow-md mb-2 transition-transform group-hover:-translate-y-1">
                            <BookCover src={item.cover} isbn={item.isbn} title={item.title} author={item.author} className="w-full h-full object-contain" />
                          </div>
                          <p className="font-serif font-bold text-xs text-primary line-clamp-2 group-hover:text-accent transition-colors">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{item.author}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
