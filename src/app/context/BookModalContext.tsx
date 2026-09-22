import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * A book for the quick view. Books from our catalogue arrive as a catalogId
 * and are loaded by the view; everything else - most of the NYT lists, many
 * award and collection titles, forthcoming books - comes with what we know
 * about it, so a reader can still choose between Bookshop.org and calling us
 * rather than being sent straight off the site.
 */
export interface ExternalBook {
  title: string;
  author: string;
  isbn?: string;
  cover?: string | null;
  /** Context for the book: "#1 · Fiction", "Winner, 2025", "Out Oct 14". */
  note?: string;
  description?: string;
  /** Publisher list price, when known. */
  price?: number | null;
  /** Not out yet: offer a preorder and a reservation rather than a purchase. */
  forthcoming?: boolean;
}

export type QuickView = { catalogId: string; book?: undefined } | { catalogId?: undefined; book: ExternalBook };

interface BookModalContextType {
  view: QuickView | null;
  /** A book in our catalogue, by id. */
  openModal: (catalogId: string) => void;
  /** A book we don't carry. */
  openExternal: (book: ExternalBook) => void;
  closeModal: () => void;
}

const BookModalContext = createContext<BookModalContextType | undefined>(undefined);

export const BookModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [view, setView] = useState<QuickView | null>(null);

  const openModal = useCallback((catalogId: string) => {
    setView({ catalogId });
    document.body.style.overflow = 'hidden';
  }, []);

  const openExternal = useCallback((book: ExternalBook) => {
    setView({ book });
    document.body.style.overflow = 'hidden';
  }, []);

  const closeModal = useCallback(() => {
    setView(null);
    document.body.style.overflow = '';
  }, []);

  return (
    <BookModalContext.Provider value={{ view, openModal, openExternal, closeModal }}>
      {children}
    </BookModalContext.Provider>
  );
};

export const useBookModal = () => {
  const context = useContext(BookModalContext);
  if (context === undefined) {
    throw new Error('useBookModal must be used within a BookModalProvider');
  }
  return context;
};
