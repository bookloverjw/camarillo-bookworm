import React from 'react';
import { BookCover } from '@/app/components/BookCover';
import { useBookModal } from '@/app/context/BookModalContext';
import type { CollectionBook } from '@/lib/collections';

/**
 * A book in a collection. Titles we carry open the quick view on our own
 * catalogue; the rest open a quick view of their own, offering Bookshop.org
 * or a call to check our shelves or order it in.
 */
export const CollectionBookCard = ({
  book,
  eyebrow,
  footer,
}: {
  book: CollectionBook;
  /** A small line above the title, e.g. "Winner" or "2024". */
  eyebrow?: React.ReactNode;
  /** Anything under the author: a note, badges. */
  footer?: React.ReactNode;
}) => {
  const { openModal, openExternal } = useBookModal();

  const body = (
    <>
      <div className="aspect-[2/3] mb-3 overflow-hidden rounded-lg shadow-sm bg-muted/30 transition-all group-hover:shadow-md group-hover:-translate-y-0.5">
        <BookCover
          src={book.cover}
          isbn={book.isbn}
          title={book.title}
          author={book.author}
          className="w-full h-full object-contain"
        />
      </div>
      {eyebrow && <div className="text-[10px] font-bold uppercase tracking-wider text-accent mb-1">{eyebrow}</div>}
      <h3 className="font-serif text-sm text-foreground leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors">
        {book.title}
      </h3>
      <p className="text-xs text-muted-foreground line-clamp-1">{book.author}</p>
      {footer ?? (book.note && <p className="text-[11px] text-muted-foreground/80 mt-1.5 leading-snug line-clamp-3">{book.note}</p>)}
    </>
  );

  if (book.catalogId) {
    return (
      <button onClick={() => openModal(book.catalogId!)} className="group text-left w-full">
        {body}
      </button>
    );
  }

  return (
    <button
      onClick={() => openExternal({ title: book.title, author: book.author, isbn: book.isbn, cover: book.cover, note: book.note })}
      className="group text-left w-full"
    >
      {body}
    </button>
  );
};
