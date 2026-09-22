import React from 'react';
import { BookCover } from '@/app/components/BookCover';
import { useBookModal } from '@/app/context/BookModalContext';
import type { UpcomingBook } from '@/lib/bookService';
import { WishlistButton } from '@/app/components/WishlistButton';

/**
 * "Out Oct 14". A month-only release date is stored as the 1st, so a date on
 * the 1st reads "Out in October" rather than claiming a day we don't know.
 */
export function releaseLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.getDate() === 1
    ? `Out in ${d.toLocaleDateString('en-US', { month: 'long' })}`
    : `Out ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/**
 * A book that isn't out yet. One we already carry opens our own quick view;
 * the rest open the external quick view, which offers a Bookshop.org
 * preorder or a call to reserve a copy.
 */
export const ForthcomingBookCard = ({ book }: { book: UpcomingBook }) => {
  const { openModal, openExternal } = useBookModal();
  const when = releaseLabel(book.publication_date);

  const open = () =>
    book.catalog_id
      ? openModal(book.catalog_id)
      : openExternal({
          title: book.title, author: book.author, isbn: book.isbn, cover: book.cover_url,
          note: when, price: book.msrp, forthcoming: true,
        });

  return (
    <div className="relative">
    <button onClick={open} className="group text-left w-full flex flex-col">
      <div className="relative aspect-[2/3] mb-4 overflow-hidden rounded-xl shadow-lg bg-muted/30 transition-all group-hover:-translate-y-1 group-hover:shadow-xl">
        <BookCover src={book.cover_url} isbn={book.isbn} title={book.title} author={book.author} className="w-full h-full object-contain" />
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-bold border backdrop-blur-md uppercase tracking-widest bg-purple-50 text-purple-700 border-purple-100">
          {when}
        </div>
      </div>
      <h3 className="font-serif font-bold text-primary group-hover:text-accent transition-colors leading-tight line-clamp-2 text-lg mb-1.5">{book.title}</h3>
      <p className="text-muted-foreground text-xs italic mb-1">by {book.author}</p>
      {book.reason && <p className="text-[11px] text-muted-foreground/80 leading-snug line-clamp-2">{book.reason}</p>}
    </button>
    <WishlistButton icon book={{ isbn: book.isbn, title: book.title, author: book.author, cover: book.cover_url, price: book.msrp }} className="absolute top-2 right-2" />
    </div>
  );
};
