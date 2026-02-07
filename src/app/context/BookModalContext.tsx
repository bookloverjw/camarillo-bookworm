import React, { createContext, useContext, useState, useCallback } from 'react';

interface BookModalContextType {
  bookId: string | null;
  isOpen: boolean;
  openModal: (bookId: string) => void;
  closeModal: () => void;
}

const BookModalContext = createContext<BookModalContextType | undefined>(undefined);

export const BookModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bookId, setBookId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openModal = useCallback((id: string) => {
    setBookId(id);
    setIsOpen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setBookId(null);
    document.body.style.overflow = '';
  }, []);

  return (
    <BookModalContext.Provider value={{ bookId, isOpen, openModal, closeModal }}>
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
