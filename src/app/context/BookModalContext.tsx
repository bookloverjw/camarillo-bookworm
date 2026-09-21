import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * A book that isn't in our catalogue - most of the NYT lists, many award and
 * collection titles, forthcoming books. It still gets a quick view, so a
 * reader can choose between Bookshop.org and calling us to check the shelf
 * or order it, rather than being sent straight off the site.
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

interface BookModalContextType {
  bookId: string | null;
  isOpen: boolean;
  openModal: (bookId: string) => void;
  external: ExternalBook | null;
  openExternal: (book: ExternalBook) => void;
  closeModal: () => void;
}

const BookModalContext = createContext<BookModalContextType | undefined>(undefined);

export const BookModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bookId, setBookId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [external, setExternal] = useState<ExternalBook | null>(null);

  const openModal = useCallback((id: string) => {
    setExternal(null);
    setBookId(id);
    setIsOpen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const openExternal = useCallback((book: ExternalBook) => {
    setIsOpen(false);
    setBookId(null);
    setExternal(book);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setBookId(null);
    setExternal(null);
    document.body.style.overflow = '';
  }, []);

  return (
    <BookModalContext.Provider value={{ bookId, isOpen, openModal, external, openExternal, closeModal }}>
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
