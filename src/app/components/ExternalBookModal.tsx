import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Phone } from 'lucide-react';
import { BookCover } from '@/app/components/BookCover';
import { PhoneLink } from '@/app/components/PhoneLink';
import { BookAwards } from '@/app/components/AwardBadge';
import { useBookModal } from '@/app/context/BookModalContext';
import { getBookshopAffiliateUrl } from '@/app/context/CartContext';
import { getBookshopSearchUrl } from '@/lib/bookshopWidgets';

/**
 * Quick view for a book we don't have in the catalogue. The catalogue is
 * months out of date, so "not in the catalogue" doesn't mean "not on the
 * shelf" - and any book can be special-ordered - so the offer is the same
 * either way: Bookshop.org, or call and let us look or order it.
 */
export const ExternalBookModal: React.FC = () => {
  const { external: book, closeModal } = useBookModal();

  useEffect(() => {
    if (!book) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeModal();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [book, closeModal]);

  const bookshopUrl = book
    ? book.isbn ? getBookshopAffiliateUrl(book.isbn) : getBookshopSearchUrl(`${book.title} ${book.author}`)
    : '';

  return (
    <AnimatePresence>
      {book && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-6"
          onClick={closeModal}
          role="dialog" aria-modal="true" aria-label={book.title}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={closeModal} aria-label="Close" className="absolute top-3 right-3 z-10 p-2 rounded-full bg-background/80 hover:bg-muted">
              <X size={20} />
            </button>

            <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6">
              <div className="w-40 sm:w-48 shrink-0 mx-auto sm:mx-0">
                <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-lg border border-border bg-muted/30">
                  <BookCover src={book.cover} isbn={book.isbn} title={book.title} author={book.author} className="w-full h-full object-contain" />
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-4">
                {book.note && <p className="text-[11px] font-bold uppercase tracking-wider text-accent">{book.note}</p>}
                <div>
                  <h2 className="text-2xl font-serif font-bold text-primary leading-tight">{book.title}</h2>
                  <p className="text-muted-foreground italic mt-1">by {book.author}</p>
                </div>
                {book.price != null && book.price > 0 && (
                  <p className="text-xl font-bold text-primary">
                    ${book.price.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">list price</span>
                  </p>
                )}
                {book.description && <p className="text-sm text-foreground/80 leading-relaxed line-clamp-6">{book.description}</p>}

                <BookAwards isbn={book.isbn} author={book.author} />

                <div className="space-y-3 pt-2">
                  <a
                    href={bookshopUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink size={16} /> {book.forthcoming ? 'Preorder on Bookshop.org' : 'Order on Bookshop.org'}
                  </a>
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Phone size={16} className="mt-0.5 shrink-0" />
                    <span>
                      {book.forthcoming
                        ? <>Or call <PhoneLink /> and we'll reserve a copy for you.</>
                        : <>Or call <PhoneLink /> — we'll check our shelves, or order it in for you.</>}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
