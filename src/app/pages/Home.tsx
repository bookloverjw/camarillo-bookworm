import React, { useRef, useState, useEffect } from 'react';
import { INVENTORY_STATUS_IS_LIVE } from '@/lib/features';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, Calendar, ArrowRight, Quote, ShoppingBag, ExternalLink, Headphones, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import { BookCover } from '@/app/components/BookCover';
import { type Book, type Event } from '@/app/utils/data';
import { getBooks, getStaffPicks, getBestsellers, getUpcomingBooks, type UpcomingBook } from '@/lib/bookService';
import { getUpcomingEvents } from '@/lib/eventsService';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { BookshopSearchBox } from '@/app/components/BookshopWidget';
import { useBookModal } from '@/app/context/BookModalContext';
import { useNewsletterSignup } from '@/app/hooks/useNewsletterSignup';
import { SeasonalBanners } from '@/app/components/SeasonalBanners';
import { activeFeatures, type ActiveFeature } from '@/lib/seasons';
import { getCollection, type CollectionBook, type CuratedCollection } from '@/lib/collections';
import { getHomepageBooks, type HomepageBook, type HomepageBooks, type Shelf } from '@/lib/homepageBooks';

/**
 * One card in a carousel. Books we carry open the quick-view modal on our own
 * catalogue; books we don't - most of this week's NYT lists, since the
 * catalogue stopped syncing in February - go straight to Bookshop.org.
 */
interface CarouselItem {
  key: string;
  title: string;
  author: string;
  cover: string | null;
  isbn?: string;
  price: number | null;
  /** A small line above the title, e.g. "#1 · Hardcover Fiction". */
  eyebrow?: string;
  catalogId?: string;
  status?: Book['status'];
  /** For the quick view of a book we don't carry. */
  description?: string;
  forthcoming?: boolean;
}

const fromCatalogue = (book: Book): CarouselItem => ({
  key: book.id,
  title: book.title,
  author: book.author,
  cover: book.cover,
  isbn: book.isbn,
  price: book.price,
  catalogId: book.id,
  status: book.status,
});

const fromList = (book: HomepageBook, { ranked }: { ranked: boolean }): CarouselItem => ({
  key: book.isbn,
  title: book.title,
  author: book.author,
  cover: book.cover,
  isbn: book.isbn,
  price: book.price,
  catalogId: book.catalogId ?? undefined,
  eyebrow: ranked && book.rank ? `#${book.rank} · ${book.list}` : undefined,
  description: book.description ?? undefined,
});

// Horizontal scrolling book carousel component - Elliott Bay style
const BookCarousel = ({ items }: { items: CarouselItem[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { openModal, openExternal } = useBookModal();

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const cardClass = 'flex-shrink-0 w-[140px] group/book text-left cursor-pointer';

  const cardBody = (item: CarouselItem) => (
    <>
      <div className="aspect-[2/3] mb-3 overflow-hidden rounded shadow-sm transition-shadow group-hover/book:shadow-md">
        <BookCover
          src={item.cover}
          isbn={item.isbn}
          title={item.title}
          author={item.author}
          className="w-full h-full object-contain"
        />
      </div>
      {item.eyebrow && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-accent mb-1 truncate">{item.eyebrow}</p>
      )}
      <h3 className="font-serif text-sm text-foreground leading-tight line-clamp-2 mb-1 group-hover/book:text-primary transition-colors">
        {item.title}
      </h3>
      {item.author && <p className="text-xs text-muted-foreground mb-1">{item.author}</p>}
      {item.price !== null && <p className="text-sm font-medium text-primary">${item.price.toFixed(2)}</p>}
      {INVENTORY_STATUS_IS_LIVE && (item.status === 'In Store' || item.status === 'Only 1 Left') && (
        <p className={`text-xs font-medium mt-1 ${item.status === 'Only 1 Left' ? 'text-amber-600' : 'text-[#16A34A]'}`}>
          {item.status === 'Only 1 Left' ? 'only 1 left' : 'in store'}
        </p>
      )}
    </>
  );

  return (
    <div className="relative group">
      {/* Scroll buttons */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity -ml-4"
      >
        <ChevronLeft size={24} className="text-primary" />
      </button>
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity -mr-4"
      >
        <ChevronRight size={24} className="text-primary" />
      </button>

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto gap-6 pb-4 scrollbar-hide scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) =>
          item.catalogId ? (
            <button key={item.key} onClick={() => openModal(item.catalogId!)} className={cardClass}>
              {cardBody(item)}
            </button>
          ) : (
            // Not in our catalogue: our own quick view, not a jump to Bookshop,
            // so the reader can still choose to call us.
            <button
              key={item.key}
              onClick={() => openExternal({
                title: item.title, author: item.author, isbn: item.isbn, cover: item.cover,
                note: item.eyebrow, description: item.description, price: item.price,
                forthcoming: item.forthcoming,
              })}
              className={cardClass}
            >
              {cardBody(item)}
            </button>
          ),
        )}
      </div>
    </div>
  );
};

/**
 * "Out Oct 14". A month-only release date is stored as the 1st, so a date on
 * the 1st reads "Out in October" rather than claiming a day we don't know.
 */
function releaseLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.getDate() === 1
    ? `Out in ${d.toLocaleDateString('en-US', { month: 'long' })}`
    : `Out ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

const fromUpcoming = (book: UpcomingBook): CarouselItem => ({
  key: book.isbn,
  title: book.title,
  author: book.author,
  cover: book.cover_url,
  isbn: book.isbn,
  price: book.msrp,
  catalogId: book.catalog_id ?? undefined,
  eyebrow: releaseLabel(book.publication_date),
  forthcoming: true,
});

const fromCollection = (book: CollectionBook, i: number): CarouselItem => ({
  key: `${book.catalogId ?? book.isbn ?? book.title}-${i}`,
  title: book.title,
  author: book.author,
  cover: book.cover ?? null,
  isbn: book.isbn,
  price: null,
  catalogId: book.catalogId,
  eyebrow: book.note,
});

/**
 * A seasonal collection on the homepage: one tab per part of it - Fiction,
 * Nonfiction, Picture books... - so each gets its own highlights instead of
 * being shuffled into one row, and a clear way through to the whole thing.
 */
const SeasonalShelf = ({ feature, collection }: { feature: ActiveFeature; collection: CuratedCollection }) => {
  const sections = collection.sections.filter(sec => sec.books.length > 0);
  const [active, setActive] = useState(0);
  const section = sections[Math.min(active, sections.length - 1)];
  // Books with a cover first; a row of placeholders sells nothing.
  const books = [...section.books.filter(b => b.cover), ...section.books.filter(b => !b.cover)].slice(0, 16);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
      <div className="text-center mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-3">In season · {feature.range}</p>
        <h2 className="section-title">
          {feature.title}
          {feature.theme && <>: “{feature.theme}”</>}
        </h2>
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">{feature.blurb}</p>
      </div>

      {sections.length > 1 && (
        // Scrolls sideways on a phone rather than wrapping onto two lines.
        <div className="flex justify-start sm:justify-center overflow-x-auto mb-8 border-b border-border -mx-4 px-4 sm:mx-0 sm:px-0"
             style={{ scrollbarWidth: 'none' }}>
          {sections.map((sec, i) => (
            <button
              key={sec.title}
              onClick={() => setActive(i)}
              className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                i === active ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-primary'
              }`}
            >
              {sec.title}
            </button>
          ))}
        </div>
      )}

      {section.subtitle && <p className="text-center text-sm text-muted-foreground -mt-4 mb-6">{section.subtitle}</p>}

      <BookCarousel items={books.map(fromCollection)} />

      <div className="mt-8 text-center">
        <Link
          to={feature.to}
          className="inline-flex items-center gap-1 rounded-full border border-primary px-5 py-2.5 text-sm font-bold text-primary hover:bg-primary hover:text-white transition-colors"
        >
          {feature.cta} <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
};

export const Home = () => {
  const [activeFilter, setActiveFilter] = useState('Fiction');
  const { email, setEmail, isSubscribing, subscribe } = useNewsletterSignup('home');
  // Start empty and fill from Supabase - never show placeholder content
  const [books, setBooks] = useState<Book[]>([]);
  const [bestsellers, setBestsellers] = useState<Book[]>([]);
  // NYT lists plus this quarter's releases; null until loaded, or if the API
  // isn't available, in which case the sections fall back to our catalogue.
  const [lists, setLists] = useState<HomepageBooks | null>(null);
  const [shelf, setShelf] = useState<Shelf>('hardcover');
  // Whatever the calendar is featuring right now, each with a sample of books.
  const [upcoming, setUpcoming] = useState<UpcomingBook[]>([]);
  const [seasonal, setSeasonal] = useState<{ feature: ActiveFeature; collection: CuratedCollection }[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  // Load data from Supabase on mount
  useEffect(() => {
    async function loadBooks() {
      try {
        const fetchedBooks = await getBooks();
        if (fetchedBooks.length > 0) {
          setBooks(fetchedBooks);
        }
      } catch (error) {
        console.error('Failed to fetch books:', error);
      }
    }

    async function loadBestsellers() {
      try {
        const data = await getBestsellers(10);
        if (data.length > 0) {
          setBestsellers(data);
        }
      } catch (error) {
        console.error('Failed to fetch bestsellers:', error);
      }
    }

    async function loadEvents() {
      try {
        const data = await getUpcomingEvents(3);
        if (data.length > 0) {
          setEvents(data);
        }
      } catch (error) {
        console.error('Failed to fetch events:', error);
      }
    }

    loadBooks();
    loadBestsellers();
    loadEvents();
    getHomepageBooks().then(setLists);
    getUpcomingBooks().then(setUpcoming).catch(() => {});

    const running = activeFeatures().filter(f => f.status === 'now');
    Promise.all(
      running.map(feature =>
        getCollection(feature.collection)
          .then(collection => ({ feature, collection }))
          .catch(() => null), // a missing collection just doesn't get a section
      ),
    ).then(found => setSeasonal(found.filter((x): x is NonNullable<typeof x> =>
      !!x && x.collection.sections.some(sec => sec.books.length > 0))));
  }, []);

  const filteredBooks = books.filter(b => b.category === activeFilter).slice(0, 8);
  // The catalogue stopped syncing in February, so most of its "preorders" are
  // out by now; only show ones whose release date is still ahead.
  const preorders = books.filter(b => b.status === 'Preorder' && (!b.releaseDate || new Date(b.releaseDate) > new Date()));
  const staffPicks = books.filter(b => b.isStaffPick);

  return (
    <div className="pb-16">
      {/* Hero Section - Cleaner, more minimal */}
      <section className="relative h-[450px] flex items-center overflow-hidden bg-primary">
        <div className="absolute inset-0 z-0">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1761384979966-546eb28f60a7?auto=format&fit=crop&q=80&w=1920"
            alt="Bookstore Interior"
            className="w-full h-full object-cover opacity-30"
          />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl text-white text-center mx-auto"
          >
            <h1 className="text-4xl md:text-5xl font-serif font-normal mb-4 leading-tight">
              Welcome to Camarillo Bookworm
            </h1>
            <p className="text-lg text-white/80 mb-8 leading-relaxed">
              Your neighborhood independent bookstore since 1973. Discover your next great read.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/shop" className="bg-white text-primary px-6 py-3 rounded text-sm font-medium hover:bg-white/90 transition-colors inline-flex items-center">
                Browse Books <ChevronRight size={18} className="ml-1" />
              </Link>
              <Link to="/events" className="bg-transparent text-white border border-white/50 px-6 py-3 rounded text-sm font-medium hover:bg-white/10 transition-colors">
                Upcoming Events
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* In season: a shelf of books for each running feature - Heritage Month,
          spooky season, the holidays - chosen by the calendar, not by hand */}
      {seasonal.map(({ feature, collection }) => (
        <SeasonalShelf key={feature.id} feature={feature} collection={collection} />
      ))}

      {/* Coming up: a teaser for features that start soon */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 empty:hidden">
        <SeasonalBanners status="upcoming" />
      </div>

      {/* Bestsellers Section - this week's NYT lists, or our own sales ranking
          if they can't be loaded */}
      {(lists || bestsellers.length > 0) && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <div className="text-center mb-10">
            <h2 className="section-title">Bestsellers</h2>
            <p className="text-muted-foreground mt-4">
              {lists ? "This week's New York Times best sellers" : 'Our most popular titles right now'}
            </p>
          </div>

          {lists && (
            <div className="flex items-center justify-center space-x-1 mb-8 border-b border-border">
              {([
                ['hardcover', 'Hardcover'],
                ['paperback', 'Paperback'],
                ['childrens', "Children's"],
              ] as [Shelf, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setShelf(key)}
                  className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    shelf === key
                      ? 'text-primary border-primary'
                      : 'text-muted-foreground border-transparent hover:text-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <BookCarousel
            items={lists
              ? lists.bestsellers[shelf].map(book => fromList(book, { ranked: true }))
              : bestsellers.map(fromCatalogue)}
          />

          <div className="mt-8 text-center">
            {lists ? (
              // The NYT's terms ask for attribution with a link back.
              <a
                href="https://www.nytimes.com/books/best-sellers/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary"
              >
                Lists from The New York Times
                {lists.listsDate &&
                  `, week of ${new Date(`${lists.listsDate}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
              </a>
            ) : (
              <Link to="/shop?sort=best-selling" className="inline-flex items-center text-primary text-sm font-medium hover:underline">
                View All Bestsellers <ArrowRight size={16} className="ml-1" />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* New Releases Section - Elliott Bay style with horizontal carousel */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <div className="text-center mb-10">
          <h2 className="section-title">New Releases</h2>
          {lists && <p className="text-muted-foreground mt-4">Out in the last three months</p>}
        </div>

        {/* Category filter tabs */}
        <div className="flex items-center justify-center space-x-1 mb-8 border-b border-border">
          {['Fiction', 'Nonfiction', 'Kids', 'YA'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeFilter === cat
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-primary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <BookCarousel
          items={lists
            ? lists.newReleases
                .filter(book => book.category === activeFilter)
                .slice(0, 16)
                .map(book => fromList(book, { ranked: false }))
            : filteredBooks.map(fromCatalogue)}
        />

        <div className="mt-8 text-center">
          <Link to="/shop" className="inline-flex items-center text-primary text-sm font-medium hover:underline">
            View All New Releases <ArrowRight size={16} className="ml-1" />
          </Link>
        </div>
      </section>

      {/* Preorders Section - Clean card layout */}
      <section className="bg-muted/50 py-16 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="section-title">Coming Soon</h2>
            <p className="text-muted-foreground mt-4">
              {upcoming.length > 0
                ? 'New books on the way from bestselling and prizewinning authors'
                : 'Preorder anticipated titles'}
            </p>
          </div>

          {/* Forthcoming books from ISBNdb once the weekly job has run; until
              then, the catalogue's own preorders */}
          <BookCarousel items={upcoming.length > 0 ? upcoming.map(fromUpcoming) : preorders.map(fromCatalogue)} />

          <div className="mt-8 text-center">
            {upcoming.length > 0 ? (
              <p className="text-xs text-muted-foreground">Preorder through Bookshop.org, or call us to reserve a copy.</p>
            ) : (
              <Link to="/shop?filter=preorder" className="inline-flex items-center text-primary text-sm font-medium hover:underline">
                View All Preorders <ArrowRight size={16} className="ml-1" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Staff Picks Section - hidden until real picks load */}
      {staffPicks.length > 0 && (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <h2 className="section-title">Staff Picks</h2>
          <p className="text-muted-foreground mt-4">Hand-selected favorites from our team</p>
        </div>

        <BookCarousel items={staffPicks.map(fromCatalogue)} />

        <div className="mt-8 text-center">
          <Link to="/staff-picks" className="inline-flex items-center text-primary text-sm font-medium hover:underline">
            View All Staff Picks <ArrowRight size={16} className="ml-1" />
          </Link>
        </div>
      </section>
      )}

      {/* Events Calendar Preview - hidden until real events load */}
      {events.length > 0 && (
      <section className="bg-primary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="font-serif text-4xl text-white font-normal mb-2">Upcoming Events</h2>
            <p className="text-white/70">Author readings, book clubs, and community gatherings</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.slice(0, 3).map((event) => (
              <Link
                key={event.id}
                to="/events"
                className="bg-white p-6 rounded flex gap-4 hover:shadow-lg transition-shadow"
              >
                {/* Date block */}
                <div className="flex-shrink-0 w-16 text-center">
                  <div className="bg-primary text-white rounded-t px-2 py-1">
                    <span className="text-xs font-medium uppercase">
                      {/* T00:00:00 forces local parsing - bare dates parse as UTC and show the previous day */}
                      {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  </div>
                  <div className="bg-muted rounded-b px-2 py-2">
                    <span className="text-2xl font-serif text-primary">
                      {new Date(event.date + 'T00:00:00').getDate()}
                    </span>
                  </div>
                </div>

                {/* Event details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-lg text-foreground leading-tight mb-1 line-clamp-2">
                    {event.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">{event.time}</p>
                  <span className="inline-block px-2 py-0.5 bg-muted text-xs text-muted-foreground rounded">
                    {event.type}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link to="/events" className="inline-flex items-center text-white text-sm font-medium hover:underline">
              View Full Calendar <ArrowRight size={16} className="ml-1" />
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* Bookshop.org & Libro.fm Integration Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-muted/50 border border-border rounded p-8 md:p-12">
          <div className="text-center mb-8">
            <h2 className="font-serif text-3xl text-foreground mb-4">Can't find what you're looking for?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Search millions of titles on Bookshop.org or browse audiobooks on Libro.fm. Every purchase supports our store!
            </p>
          </div>

          {/* Bookshop.org Search Widget */}
          <div className="max-w-lg mx-auto mb-8">
            <BookshopSearchBox includeBranding={false} className="bookshop-search-widget" />
          </div>

          {/* Direct links */}
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://bookshop.org/shop/camarillobookworm"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center bg-[#EF4056] text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-[#EF4056]/90 transition-colors"
            >
              Browse Bookshop.org <ExternalLink size={16} className="ml-2" />
            </a>
            <a
              href="https://libro.fm/camarillobookworm"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center bg-primary text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Headphones size={16} className="mr-2" /> Audiobooks on Libro.fm
            </a>
          </div>
        </div>
      </section>

      {/* Newsletter Signup - Bottom section */}
      <section className="bg-muted/50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="font-serif text-3xl text-foreground mb-4">Stay in the loop</h2>
            <p className="text-muted-foreground mb-6">
              Get monthly book recommendations, event invites, and exclusive offers.
            </p>
            <form onSubmit={subscribe} className="flex gap-2 max-w-md mx-auto">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                aria-label="Email address"
                className="flex-1 px-4 py-3 rounded border border-border bg-white text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={isSubscribing}
                className="bg-primary text-white px-6 py-3 rounded text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSubscribing ? 'Subscribing…' : 'Subscribe'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};
