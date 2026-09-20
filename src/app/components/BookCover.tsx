import React, { useState } from 'react';

/**
 * A book's cover, from the best source available.
 *
 * Most of the catalogue has no cover_url of its own, and every one of those
 * titles used to render the same stock photograph - which made the shop look
 * abandoned. This tries the catalogue's image first, then Open Library's cover
 * API by ISBN, and finally draws a placeholder with the book's own title on it.
 */

const openLibraryCover = (isbn: string) =>
  // default=false makes Open Library 404 instead of serving a blank image,
  // which is what lets onError fall through to the placeholder.
  `https://covers.openlibrary.org/b/isbn/${isbn.replace(/[^0-9Xx]/g, '')}-L.jpg?default=false`;

interface BookCoverProps {
  src?: string | null;
  isbn?: string | null;
  title: string;
  author?: string;
  className?: string;
}

export const BookCover = ({ src, isbn, title, author, className }: BookCoverProps) => {
  const sources = [src, isbn ? openLibraryCover(isbn) : null].filter(
    (url): url is string => Boolean(url && url.trim()),
  );

  // Reset to the first source when the component is reused for another book,
  // rather than carrying the previous book's failures over.
  const identity = `${src ?? ''}|${isbn ?? ''}`;
  const [attempt, setAttempt] = useState({ identity, index: 0 });
  const index = attempt.identity === identity ? attempt.index : 0;

  if (index >= sources.length) {
    return <PlaceholderCover title={title} author={author} className={className} />;
  }

  return (
    <img
      src={sources[index]}
      alt={title}
      className={className}
      loading="lazy"
      onError={() => setAttempt({ identity, index: index + 1 })}
    />
  );
};

/** A drawn stand-in for a book we have no photograph of. */
const PlaceholderCover = ({
  title,
  author,
  className,
}: Pick<BookCoverProps, 'title' | 'author' | 'className'>) => (
  <div
    className={`flex flex-col justify-between bg-primary text-white p-3 overflow-hidden ${className ?? ''}`}
    aria-label={title}
  >
    <div className="border-l-2 border-white/30 pl-2">
      <p className="font-serif font-bold leading-tight line-clamp-4 text-[clamp(0.6rem,1.1vw,0.95rem)]">
        {title}
      </p>
      {author && (
        <p className="mt-1 text-white/60 line-clamp-2 text-[clamp(0.5rem,0.9vw,0.75rem)]">
          {author}
        </p>
      )}
    </div>
    <p className="text-white/40 uppercase tracking-widest text-[clamp(0.4rem,0.7vw,0.6rem)]">
      Camarillo Bookworm
    </p>
  </div>
);
