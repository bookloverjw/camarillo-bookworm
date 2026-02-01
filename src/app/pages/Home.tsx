import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, Calendar, ArrowRight, Quote, ShoppingBag, ExternalLink, Headphones } from 'lucide-react';
import { Link } from 'react-router';
import { BOOKS, EVENTS, MERCH, STAFF, type Book } from '@/app/utils/data';
import { getBooks, getStaffPicks } from '@/lib/bookService';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { BookshopSearchBox } from '@/app/components/BookshopWidget';

// Horizontal scrolling book carousel component - Elliott Bay style
const BookCarousel = ({ books, title }: { books: typeof BOOKS; title: string }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

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
        {books.map((book) => (
          <Link
            key={book.id}
            to={`/book/${book.id}`}
            className="flex-shrink-0 w-[140px] group/book"
          >
            <div className="aspect-[2/3] mb-3 overflow-hidden rounded shadow-sm transition-shadow group-hover/book:shadow-md">
              <ImageWithFallback
                src={book.cover}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="font-serif text-sm text-foreground leading-tight line-clamp-2 mb-1 group-hover/book:text-primary transition-colors">
              {book.title}
            </h3>
            <p className="text-xs text-muted-foreground mb-1">{book.author}</p>
            <p className="text-sm font-medium text-primary">${book.price.toFixed(2)}</p>
            {book.status === 'In Stock' && (
              <p className="text-xs text-[#16A34A] font-medium mt-1">in store</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
};

export const Home = () => {
  const [activeFilter, setActiveFilter] = useState('Fiction');
  const [books, setBooks] = useState<Book[]>(BOOKS);

  // Load books from Supabase on mount
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
    loadBooks();
  }, []);

  const filteredBooks = books.filter(b => b.category === activeFilter).slice(0, 8);
  const newReleases = books.filter(b => b.status !== 'Preorder').slice(0, 10);
  const preorders = books.filter(b => b.status === 'Preorder');
  const staffPicks = books.filter(b => b.isStaffPick);
  const staffPick = books.find(b => b.isStaffPick);
  const featuredStaff = STAFF.find(s => s.topPicks.includes(staffPick?.id || ''));

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

      {/* New Releases Section - Elliott Bay style with horizontal carousel */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
        <div className="text-center mb-10">
          <h2 className="section-title">New Releases</h2>
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

        <BookCarousel books={filteredBooks} title="New Releases" />

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
            <p className="text-muted-foreground mt-4">Preorder anticipated titles</p>
          </div>

          <BookCarousel books={preorders} title="Coming Soon" />

          <div className="mt-8 text-center">
            <Link to="/shop?filter=preorder" className="inline-flex items-center text-primary text-sm font-medium hover:underline">
              View All Preorders <ArrowRight size={16} className="ml-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Staff Picks Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <h2 className="section-title">Staff Picks</h2>
          <p className="text-muted-foreground mt-4">Hand-selected favorites from our team</p>
        </div>

        <BookCarousel books={staffPicks.length > 0 ? staffPicks : BOOKS.slice(0, 8)} title="Staff Picks" />

        <div className="mt-8 text-center">
          <Link to="/staff-picks" className="inline-flex items-center text-primary text-sm font-medium hover:underline">
            View All Staff Picks <ArrowRight size={16} className="ml-1" />
          </Link>
        </div>
      </section>

      {/* Events Calendar Preview - Clean white cards */}
      <section className="bg-primary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="font-serif text-4xl text-white font-normal mb-2">Upcoming Events</h2>
            <p className="text-white/70">Author readings, book clubs, and community gatherings</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {EVENTS.slice(0, 3).map((event) => (
              <Link
                key={event.id}
                to="/events"
                className="bg-white p-6 rounded flex gap-4 hover:shadow-lg transition-shadow"
              >
                {/* Date block */}
                <div className="flex-shrink-0 w-16 text-center">
                  <div className="bg-primary text-white rounded-t px-2 py-1">
                    <span className="text-xs font-medium uppercase">
                      {new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  </div>
                  <div className="bg-muted rounded-b px-2 py-2">
                    <span className="text-2xl font-serif text-primary">
                      {new Date(event.date).getDate()}
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
              Get weekly book recommendations, event invites, and exclusive offers.
            </p>
            <form className="flex gap-2 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 px-4 py-3 rounded border border-border bg-white text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="bg-primary text-white px-6 py-3 rounded text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};
