import React from 'react';

/**
 * BookmarksReviews — embeds the Book Marks (bookmarks.reviews / Literary Hub)
 * review aggregator widget for a given ISBN via iframe.
 *
 * If Book Marks has no data for the ISBN, the iframe renders empty.
 * Uses the iframe endpoint at lithub.com/book-widget/{isbn}/0/0/.
 *
 * @see https://bookmarks.reviews/what-is-the-widget/
 */
export const BookmarksReviews: React.FC<{ isbn: string }> = ({ isbn }) => {
  if (!isbn) return null;

  const src = `https://lithub.com/book-widget/${isbn}/0/0/?ver=1.5.1`;

  return (
    <div className="bookmarks-reviews-widget">
      <iframe
        src={src}
        title="Book Marks reviews"
        style={{
          width: '100%',
          minHeight: 320,
          border: 'none',
          overflow: 'hidden',
        }}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
};
