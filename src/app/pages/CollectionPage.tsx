import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { CollectionBookCard } from '@/app/components/CollectionBookCard';
import { BannedBooksWeekBanner } from '@/app/pages/Collections';
import { useDocumentTitle } from '@/app/hooks/useDocumentTitle';
import { getCollection, type CuratedCollection } from '@/lib/collections';

/** A curated list: Banned & Challenged Books, The Book Was Better, and so on. */
export const CollectionPage = () => {
  const { slug = '' } = useParams();
  const [collection, setCollection] = useState<CuratedCollection | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setCollection(null);
    setMissing(false);
    getCollection(slug).then(setCollection).catch(() => setMissing(true));
  }, [slug]);

  useDocumentTitle(collection?.title ?? null);

  if (missing) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-serif font-bold text-primary mb-4">We couldn't find that collection</h1>
        <Link to="/collections" className="text-primary hover:underline">See all collections</Link>
      </div>
    );
  }

  if (!collection) return <div className="py-32" aria-busy="true" />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <Link to="/collections" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-8">
        <ArrowLeft size={16} /> All collections
      </Link>

      <header className="max-w-3xl mb-12">
        <h1 className="text-4xl sm:text-5xl font-serif font-bold text-primary mb-3">{collection.title}</h1>
        <p className="text-xl text-accent font-serif italic mb-4">{collection.tagline}</p>
        <p className="text-muted-foreground">{collection.description}</p>
      </header>

      {collection.slug === 'banned-books' && <div className="mb-12"><BannedBooksWeekBanner /></div>}

      {collection.sections.map(section => (
        <section key={section.title} className="mb-16">
          <div className="mb-6 border-b border-border pb-3">
            <h2 className="text-2xl font-serif font-bold text-primary">{section.title}</h2>
            {section.subtitle && <p className="text-sm text-muted-foreground mt-1">{section.subtitle}</p>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-8">
            {section.books.map((book, i) => (
              <CollectionBookCard key={`${book.title}-${i}`} book={book} />
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-muted-foreground border-t border-border pt-6">
        Source:{' '}
        <a href={collection.source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary inline-flex items-center gap-1">
          {collection.source.name} <ExternalLink size={11} />
        </a>
        . Books we carry open in our store; the rest link to Bookshop.org, which supports us too.
      </p>
    </div>
  );
};
