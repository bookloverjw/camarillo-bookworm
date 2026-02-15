import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, ShoppingBag, Store, Truck, ExternalLink, Headphones, Calendar } from 'lucide-react';
import { Link } from 'react-router';
import { useBookModal } from '@/app/context/BookModalContext';
import { useCart, getBookshopAffiliateUrl } from '@/app/context/CartContext';
import { BOOKS, type Book } from '@/app/utils/data';
import { getBookById, getBooks } from '@/lib/bookService';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { BookmarksReviews } from '@/app/components/BookmarksReviews';
import { stripHtmlTags } from '@/lib/stripHtml';
import { getLibroFmUrl } from '@/lib/bookshopWidgets';
import { toast } from 'sonner';

// Static review data for the modal (adapted from the source improvements)
const BOOK_REVIEWS: Record<string, Array<{ name: string; rating: number; text: string }>> = {
  '1': [
    { name: 'Sarah M.', rating: 5, text: 'A beautiful exploration of the roads not taken. This book changed how I think about regret.' },
    { name: 'James R.', rating: 4, text: 'Heartwarming and thought-provoking. A quick read that stays with you long after.' },
  ],
  '2': [
    { name: 'Alex K.', rating: 5, text: 'Practical and actionable. I have already started implementing the habit stacking technique.' },
    { name: 'Maria L.', rating: 5, text: 'The best book on building better habits. Clear writing and compelling research.' },
  ],
  '5': [
    { name: 'Jenny T.', rating: 5, text: 'Raw, beautiful, and deeply personal. Zauner writes about grief and identity with incredible grace.' },
    { name: 'David P.', rating: 4, text: 'A moving memoir that connects food, culture, and loss in unexpected ways.' },
  ],
  '6': [
    { name: 'Chris W.', rating: 5, text: 'Doerr weaves timelines together masterfully. Each storyline is compelling on its own.' },
    { name: 'Nina S.', rating: 4, text: 'Ambitious and beautifully written. The connections between characters across centuries are stunning.' },
  ],
  '7': [
    { name: 'Tom B.', rating: 5, text: 'Even better than The Martian. The friendship that develops is pure joy to read.' },
    { name: 'Rachel H.', rating: 5, text: 'Gripping sci-fi with heart and humor. I could not put this book down.' },
  ],
  '10': [
    { name: 'Patricia G.', rating: 5, text: 'Witty, empowering, and brilliantly written. Elizabeth Zott is my new favorite character.' },
    { name: 'Mark D.', rating: 4, text: 'A delightful read about breaking barriers in science and society.' },
  ],
  '12': [
    { name: 'Linda F.', rating: 5, text: 'Kingsolver at her finest. A modern Dickens tale set in Appalachia that feels urgent and real.' },
    { name: 'Steve N.', rating: 5, text: 'Devastating and beautiful. The voice of Demon will stay with me forever.' },
  ],
};

// Default reviews for books without specific ones
const DEFAULT_REVIEWS = [
  { name: 'A Bookworm Reader', rating: 4, text: 'A wonderful read! Highly recommended for anyone looking for their next great book.' },
  { name: 'Local Book Club', rating: 5, text: 'Our book club loved discussing this one. Rich characters and compelling narrative.' },
];

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={14}
        className={i < rating ? 'fill-accent text-accent' : 'text-border fill-border'}
      />
    ))}
  </div>
);

export const BookDetailModal: React.FC = () => {
  const { bookId, isOpen, closeModal, openModal } = useBookModal();
  const { addItem } = useCart();
  const [book, setBook] = useState<Book | null>(null);
  const [related, setRelated] = useState<Book[]>([]);

  useEffect(() => {
    if (!bookId || !isOpen) {
      setBook(null);
      setRelated([]);
      return;
    }

    async function load() {
      try {
        const fetched = await getBookById(bookId!);
        setBook(fetched);
        if (fetched) {
          const allBooks = await getBooks();
          setRelated(
            allBooks
              .filter(b => b.category === fetched.category && b.id !== bookId)
              .slice(0, 4)
          );
        }
      } catch {
        const staticBook = BOOKS.find(b => b.id === bookId);
        setBook(staticBook || null);
        if (staticBook) {
          setRelated(
            BOOKS.filter(b => b.category === staticBook.category && b.id !== bookId).slice(0, 4)
          );
        }
      }
    }
    load();
  }, [bookId, isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) closeModal();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeModal]);

  const reviews = bookId ? (BOOK_REVIEWS[bookId] || DEFAULT_REVIEWS) : [];

  const handleAddToCart = (deliveryOption: 'pickup' | 'ship') => {
    if (!book) return;
    const bookIsbn = book.isbn || `978${book.id.padStart(10, '0')}`;
    addItem(
      {
        id: book.id,
        isbn: bookIsbn,
        title: book.title,
        author: book.author,
        price: book.price,
        cover: book.cover,
        type: book.type,
        bookshopUrl: getBookshopAffiliateUrl(bookIsbn),
      },
      1,
      deliveryOption
    );
    toast.success(
      deliveryOption === 'pickup'
        ? `"${book.title}" added for in-store pickup!`
        : `"${book.title}" added to cart!`
    );
  };

  const handleRelatedClick = (relatedId: string) => {
    openModal(relatedId);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label={book ? `Details for ${book.title}` : 'Book details'}
            className="fixed inset-4 md:inset-8 lg:inset-16 z-[201] bg-background rounded-2xl shadow-2xl overflow-y-auto border border-border"
          >
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 p-2 bg-muted hover:bg-muted/80 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            {book ? (
              <div className="p-6 md:p-10">
                {/* Top section: cover + info */}
                <div className="flex flex-col md:flex-row gap-8 mb-10">
                  {/* Cover */}
                  <div className="w-full md:w-48 lg:w-56 shrink-0">
                    <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-lg border border-border bg-black">
                      <ImageWithFallback
                        src={book.cover}
                        alt={book.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 space-y-4">
                    <span className="inline-block px-2 py-0.5 bg-muted text-xs text-muted-foreground rounded font-medium uppercase tracking-wide">
                      {book.genre}
                    </span>
                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary leading-tight">
                      {book.title}
                    </h2>
                    {book.subtitle && (
                      <p className="text-lg md:text-xl text-muted-foreground font-serif leading-snug">
                        {book.subtitle}
                      </p>
                    )}
                    <p className="text-lg text-muted-foreground font-serif italic">
                      by {book.author}
                    </p>
                    <div className="flex items-center gap-3">
                      <StarRating rating={4} />
                      <span className="text-sm text-muted-foreground">(42 reviews)</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">${book.price.toFixed(2)}</p>
                    <div className="text-muted-foreground leading-relaxed whitespace-pre-line">{stripHtmlTags(book.description)}</div>

                    {/* Meta info */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border text-sm">
                      <div>
                        <p className="text-muted-foreground">Format</p>
                        <p className="font-medium text-foreground">{book.type}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Category</p>
                        <p className="font-medium text-foreground">{book.category}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">ISBN</p>
                        <p className="font-medium text-foreground">{book.isbn || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Purchase actions — priority: pickup > ship > bookshop/libro */}
                    {book.status === 'Preorder Closed' ? (
                      <div className="space-y-3 pt-4">
                        <div className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-gray-100 text-gray-400 rounded-lg text-sm font-bold cursor-not-allowed">
                          <Calendar size={16} /> Preorder Closed
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          The preorder window for this edition has ended.
                          {book.releaseDate && ` Releases ${book.releaseDate}.`}
                        </p>
                        <div className="flex items-center justify-center gap-4">
                          <Link
                            to={`/book/${book.id}`}
                            onClick={closeModal}
                            className="flex items-center gap-1.5 text-muted-foreground hover:text-primary text-sm font-medium transition-colors"
                          >
                            View Full Details <ExternalLink size={14} />
                          </Link>
                        </div>
                      </div>
                    ) : book.status === 'Ships in X days' ? (
                      <div className="space-y-3 pt-4">
                        <a
                          href={getBookshopAffiliateUrl(book.isbn || `978${book.id.padStart(10, '0')}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
                        >
                          <ExternalLink size={16} /> Order on Bookshop.org
                        </a>
                        <p className="text-xs text-muted-foreground text-center">Ships faster via Bookshop.org — still supports our store!</p>
                        <div className="flex items-center justify-center gap-4">
                          <a
                            href={getLibroFmUrl(book.title)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Headphones size={14} /> Listen on Libro.fm
                          </a>
                          <span className="text-border">|</span>
                          <Link
                            to={`/book/${book.id}`}
                            onClick={closeModal}
                            className="flex items-center gap-1.5 text-muted-foreground hover:text-primary text-sm font-medium transition-colors"
                          >
                            View Full Details <ExternalLink size={14} />
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-4">
                        {book.status === 'Preorder' && book.isLimitedPreorder && book.preorderCutoffDate && (
                          <p className="text-xs text-purple-600 font-medium">
                            Preorder by {new Date(book.preorderCutoffDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => handleAddToCart('pickup')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
                          >
                            <Store size={16} /> In-Store Pickup
                          </button>
                          <button
                            onClick={() => handleAddToCart('ship')}
                            className="flex items-center gap-2 px-5 py-2.5 border-2 border-primary text-primary rounded-lg text-sm font-bold hover:bg-primary hover:text-white transition-colors"
                          >
                            <Truck size={16} /> Ship to Me
                          </button>
                          <Link
                            to={`/book/${book.id}`}
                            onClick={closeModal}
                            className="flex items-center gap-2 px-5 py-2.5 text-muted-foreground hover:text-primary text-sm font-medium transition-colors"
                          >
                            View Full Details <ExternalLink size={14} />
                          </Link>
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <a
                            href={getBookshopAffiliateUrl(book.isbn || `978${book.id.padStart(10, '0')}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            <ExternalLink size={10} /> Bookshop.org
                          </a>
                          <span className="text-border text-xs">|</span>
                          <a
                            href={getLibroFmUrl(book.title)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Headphones size={10} /> Libro.fm
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reviews section */}
                <div className="mb-10">
                  <h3 className="text-xl font-serif font-bold text-primary mb-6 pb-2 border-b border-border">
                    Reader Reviews
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {reviews.map((review, i) => (
                      <div
                        key={i}
                        className="p-5 bg-muted/50 rounded-xl border border-border"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-sm text-foreground">{review.name}</span>
                          <StarRating rating={review.rating} />
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          "{review.text}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bookmarks.reviews critic reviews */}
                {book.isbn && (
                  <div className="mb-10">
                    <h3 className="text-xl font-serif font-bold text-primary mb-6 pb-2 border-b border-border">
                      Critic Reviews
                    </h3>
                    <BookmarksReviews isbn={book.isbn} />
                  </div>
                )}

                {/* Related titles */}
                {related.length > 0 && (
                  <div>
                    <h3 className="text-xl font-serif font-bold text-primary mb-6 pb-2 border-b border-border">
                      You Might Also Like
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {related.map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleRelatedClick(item.id)}
                          className="group text-left"
                        >
                          <div className="aspect-[2/3] rounded-lg overflow-hidden shadow-md mb-3 transition-transform group-hover:-translate-y-1 bg-black">
                            <ImageWithFallback
                              src={item.cover}
                              alt={item.title}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <h4 className="font-serif font-bold text-sm text-primary line-clamp-1 group-hover:text-accent transition-colors">
                            {item.title}
                          </h4>
                          <p className="text-xs text-muted-foreground">{item.author}</p>
                          <p className="text-sm font-bold text-primary mt-1">
                            ${item.price.toFixed(2)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
