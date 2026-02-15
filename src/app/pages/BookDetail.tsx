import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'framer-motion';
import { ShoppingBag, Truck, Store, ExternalLink, ArrowLeft, Heart, Share2, Star, Quote, CheckCircle, AlertCircle, Clock, Calendar, Loader2, Headphones } from 'lucide-react';
import { BOOKS, type Book } from '@/app/utils/data';
import { getBookById, getBooks } from '@/lib/bookService';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { toast } from 'sonner';
import { useCart, getBookshopAffiliateUrl } from '@/app/context/CartContext';
import { useAuth } from '@/app/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { stripHtmlTags } from '@/lib/stripHtml';
import { BookmarksReviews } from '@/app/components/BookmarksReviews';
import { getLibroFmUrl } from '@/lib/bookshopWidgets';

export const BookDetail = () => {
  const { id } = useParams();
  const { addItem } = useCart();
  const { user } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [recommendations, setRecommendations] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingToWishlist, setIsAddingToWishlist] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);

  // Load book from database
  useEffect(() => {
    async function loadBook() {
      if (!id) return;
      setIsLoading(true);
      try {
        const fetchedBook = await getBookById(id);
        setBook(fetchedBook);

        // Load recommendations (same category, different book)
        if (fetchedBook) {
          const allBooks = await getBooks();
          const recs = allBooks.filter(b => b.category === fetchedBook.category && b.id !== id).slice(0, 4);
          setRecommendations(recs);
        }
      } catch (error) {
        console.error('Failed to fetch book:', error);
        // Try static fallback
        const staticBook = BOOKS.find(b => b.id === id);
        setBook(staticBook || null);
        if (staticBook) {
          setRecommendations(BOOKS.filter(b => b.category === staticBook.category && b.id !== id).slice(0, 4));
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadBook();
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <Loader2 size={48} className="mx-auto animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading book details...</p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <h2 className="text-3xl font-serif font-bold text-primary mb-4">Book Not Found</h2>
        <Link to="/shop" className="text-accent font-bold hover:underline inline-flex items-center">
          <ArrowLeft size={18} className="mr-2" /> Back to Shop
        </Link>
      </div>
    );
  }

  // Use real ISBN or generate one for Bookshop.org links
  const bookIsbn = book.isbn || `978${book.id.padStart(10, '0')}`;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'In Stock': return <CheckCircle size={18} className="text-green-600" />;
      case 'Low Stock': return <AlertCircle size={18} className="text-yellow-600" />;
      case 'Preorder': return <Calendar size={18} className="text-purple-600" />;
      case 'Preorder Closed': return <Calendar size={18} className="text-gray-400" />;
      case 'Ships in X days': return <Clock size={18} className="text-blue-600" />;
      default: return null;
    }
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'In Stock': return `✓ In Stock at Camarillo Bookworm (3 copies)`;
      case 'Low Stock': return `Only 1 left at Camarillo Bookworm!`;
      case 'Preorder': return book.isLimitedPreorder && book.preorderCutoffDate
        ? `Preorder by ${new Date(book.preorderCutoffDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - Ships on ${book.releaseDate}`
        : `Preorder - Ships on ${book.releaseDate}`;
      case 'Preorder Closed': return `Preorder closed${book.preorderCutoffDate ? ` on ${new Date(book.preorderCutoffDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : ''}`;
      case 'Ships in X days': return `Available to ship in 2-3 business days`;
      default: return status;
    }
  };

  const handleAddToCart = (deliveryOption: 'pickup' | 'ship') => {
    addItem({
      id: book.id,
      isbn: bookIsbn,
      title: book.title,
      author: book.author,
      price: book.price,
      cover: book.cover,
      type: book.type,
      bookshopUrl: getBookshopAffiliateUrl(bookIsbn),
    }, 1, deliveryOption);

    toast.success(
      deliveryOption === 'pickup'
        ? `"${book.title}" added for in-store pickup!`
        : `"${book.title}" added to cart!`,
      {
        action: {
          label: 'View Cart',
          onClick: () => window.location.href = '#/cart',
        },
      }
    );
  };

  const handleAddToWishlist = async () => {
    if (!user) {
      toast.error('Please sign in to add to wishlist', {
        action: {
          label: 'Sign In',
          onClick: () => window.location.href = '#/login?redirect=/book/' + book.id,
        },
      });
      return;
    }

    setIsAddingToWishlist(true);

    try {
      // Get or create default wishlist
      let { data: wishlist } = await supabase
        .from('wishlists')
        .select('id')
        .eq('customer_id', user.id)
        .eq('name', 'My Wishlist')
        .single();

      if (!wishlist) {
        const { data: newWishlist, error: createError } = await supabase
          .from('wishlists')
          .insert({
            customer_id: user.id,
            name: 'My Wishlist',
            is_public: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) throw createError;
        wishlist = newWishlist;
      }

      // Add item to wishlist
      const { error: itemError } = await supabase.from('wishlist_items').insert({
        wishlist_id: wishlist.id,
        isbn: bookIsbn,
        title: book.title,
        author: book.author,
        cover_url: book.cover,
        price: book.price,
        added_at: new Date().toISOString(),
      });

      if (itemError) {
        if (itemError.code === '23505') {
          toast.info('Already in your wishlist!');
        } else {
          throw itemError;
        }
      } else {
        setIsInWishlist(true);
        toast.success('Added to wishlist!', {
          action: {
            label: 'View Wishlist',
            onClick: () => window.location.href = '#/account/wishlist',
          },
        });
      }
    } catch (err) {
      console.error('Wishlist error:', err);
      toast.error('Failed to add to wishlist. Please try again.');
    } finally {
      setIsAddingToWishlist(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: book.title,
      text: `Check out "${book.title}" by ${book.author} at Camarillo Bookworm!`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
    } catch (err) {
      // User cancelled share
    }
  };

  return (
    <div className="pb-24">
      {/* Breadcrumb */}
      <div className="bg-muted/30 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <span>/</span>
            <Link to="/shop" className="hover:text-primary transition-colors">Shop</Link>
            <span>/</span>
            <Link to={`/shop?category=${encodeURIComponent(book.category)}`} className="hover:text-primary transition-colors">{book.category}</Link>
            {book.genre && (
              <>
                <span>/</span>
                <Link to={`/shop?category=${encodeURIComponent(book.category)}&genre=${encodeURIComponent(book.genre)}`} className="hover:text-primary transition-colors">{book.genre}</Link>
              </>
            )}
            <span>/</span>
            <span className="text-primary font-medium line-clamp-1">{book.title}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left: Image */}
          <div className="lg:col-span-4 space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-[320px] mx-auto lg:mx-0 rounded-xl overflow-hidden shadow-xl border border-border sticky top-28 bg-black"
            >
              <ImageWithFallback src={book.cover} alt={book.title} className="w-full h-auto object-contain" />
              {book.isStaffPick && (
                <div className="absolute top-4 left-4 bg-accent text-white font-bold px-3 py-1.5 rounded shadow-lg flex items-center uppercase tracking-widest text-xs">
                  <Quote size={12} className="mr-1.5 fill-white" /> Staff Pick
                </div>
              )}
            </motion.div>
          </div>

          {/* Right: Info */}
          <div className="lg:col-span-8 space-y-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={16} className={i < 4 ? "fill-accent text-accent" : "text-border fill-border"} />
                ))}
                <span className="text-sm text-muted-foreground">(42 reviews)</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-2 leading-tight">{book.title}</h1>
              {book.subtitle && (
                <p className="text-xl md:text-2xl text-muted-foreground font-serif leading-snug mb-2">{book.subtitle}</p>
              )}
              <p className="text-2xl text-muted-foreground font-serif italic mb-6">by {book.author}</p>

              <div className="flex items-center space-x-6">
                <p className="text-3xl font-bold text-primary">${book.price.toFixed(2)}</p>
                <div className="px-3 py-1 bg-muted border border-border rounded text-sm font-medium text-primary uppercase tracking-wider">
                  {book.type}
                </div>
              </div>
            </div>

            <div className="p-6 bg-muted/50 rounded-xl border border-border space-y-6">
              <div className="flex items-center space-x-3">
                {getStatusIcon(book.status)}
                <span className={`font-bold text-sm ${book.status === 'In Stock' ? 'text-green-700' : 'text-primary'}`}>
                  {getStatusMessage(book.status)}
                </span>
              </div>

              {/* Purchase buttons — priority: pickup > ship > bookshop */}
              {book.status === 'Preorder Closed' ? (
                /* Limited preorder window has closed */
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 w-full p-4 bg-gray-100 text-gray-400 rounded-xl font-bold cursor-not-allowed">
                    <Calendar size={20} />
                    <span className="text-sm uppercase tracking-widest">Preorder Closed</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    The preorder window for this edition has ended.
                    {book.releaseDate && ` This title releases on ${book.releaseDate}.`}
                  </p>
                </div>
              ) : book.status === 'Ships in X days' ? (
                /* Out of stock locally — promote Bookshop as the fastest option */
                <div className="space-y-3">
                  <a
                    href={getBookshopAffiliateUrl(bookIsbn)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full p-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all"
                  >
                    <ExternalLink size={20} />
                    <span className="text-sm uppercase tracking-widest">Order on Bookshop.org</span>
                  </a>
                  <p className="text-xs text-muted-foreground text-center">Ships faster via Bookshop.org — and still supports our store!</p>
                  <a
                    href={getLibroFmUrl(book.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Headphones size={14} />
                    <span>Listen on Libro.fm</span>
                  </a>
                </div>
              ) : (
                /* In stock, low stock, or preorder — our store buttons are primary */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      onClick={() => handleAddToCart('pickup')}
                      className="flex flex-col items-center justify-center p-4 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all group"
                    >
                      <Store size={24} className="mb-2" />
                      <span className="text-xs font-bold uppercase tracking-widest">In-Store Pickup</span>
                    </button>
                    <button
                      onClick={() => handleAddToCart('ship')}
                      className="flex flex-col items-center justify-center p-4 bg-white border-2 border-primary rounded-xl hover:bg-primary hover:text-white transition-all group"
                    >
                      <Truck size={24} className="mb-2 text-primary group-hover:text-white" />
                      <span className="text-xs font-bold uppercase tracking-widest">Ship to Me</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-4 pt-1">
                    <a
                      href={getBookshopAffiliateUrl(bookIsbn)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink size={14} />
                      <span>Bookshop.org</span>
                    </a>
                    <span className="text-border">|</span>
                    <a
                      href={getLibroFmUrl(book.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Headphones size={14} />
                      <span>Libro.fm</span>
                    </a>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <button
                  onClick={handleAddToWishlist}
                  disabled={isAddingToWishlist}
                  className={`flex items-center space-x-2 text-sm font-bold transition-colors ${
                    isInWishlist ? 'text-accent' : 'text-primary hover:text-accent'
                  } disabled:opacity-50`}
                >
                  {isAddingToWishlist ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Heart size={18} className={isInWishlist ? 'fill-current' : ''} />
                  )}
                  <span>{isInWishlist ? 'In Wishlist' : 'Add to Wishlist'}</span>
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center space-x-2 text-sm font-bold text-primary hover:text-accent transition-colors"
                >
                  <Share2 size={18} />
                  <span>Share</span>
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-primary mb-4 border-b border-border pb-2">Description</h3>
                <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {stripHtmlTags(book.description)}
                </div>
              </div>

              {book.isStaffPick && (
                <div className="bg-accent/5 p-8 rounded-2xl border border-accent/20 relative">
                  <Quote size={48} className="absolute -top-6 -left-2 text-accent/10 fill-accent/10" />
                  <h3 className="text-lg font-bold text-accent mb-4">Staff Pick Review</h3>
                  <p className="italic text-primary leading-relaxed mb-6">
                    "{book.staffQuote} I couldn't put it down. The prose is beautiful and the characters feel like real people I've known my whole life."
                  </p>
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full bg-muted border border-border overflow-hidden">
                      <ImageWithFallback src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100" alt="Reviewer" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="font-bold text-primary leading-none">{book.staffReviewer}</p>
                      <p className="text-xs text-muted-foreground">Store Staff</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bookmarks.reviews — critic review aggregator */}
              {bookIsbn && (
                <div>
                  <h3 className="text-lg font-bold text-primary mb-4 border-b border-border pb-2">Critic Reviews</h3>
                  <BookmarksReviews isbn={bookIsbn} />
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-primary mb-4 border-b border-border pb-2">Product Details</h3>
                <div className="grid grid-cols-2 gap-y-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Publisher</p>
                    <p className="font-medium text-primary">Vintage Books</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Publication Date</p>
                    <p className="font-medium text-primary">Oct 26, 2024</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ISBN</p>
                    <p className="font-medium text-primary">{bookIsbn}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pages</p>
                    <p className="font-medium text-primary">320</p>
                  </div>
                </div>
              </div>

              {/* Bookshop.org Attribution */}
              <div className="p-4 bg-secondary/5 rounded-xl border border-secondary/20">
                <p className="text-xs text-muted-foreground">
                  Can't find it in our store? Order through{' '}
                  <a
                    href={getBookshopAffiliateUrl(bookIsbn)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary font-bold hover:underline"
                  >
                    Bookshop.org
                  </a>
                  {' '}and we'll still earn a portion of the sale. Every purchase supports independent bookstores!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* You Might Also Like */}
        <div className="mt-32">
          <h2 className="text-3xl font-serif font-bold text-primary mb-12">You Might Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {recommendations.map(item => (
              <Link key={item.id} to={`/book/${item.id}`} className="group">
                <div className="aspect-[2/3] rounded-lg overflow-hidden shadow-md mb-4 transition-transform group-hover:-translate-y-2 bg-black">
                  <ImageWithFallback src={item.cover} alt={item.title} className="w-full h-full object-contain" />
                </div>
                <h4 className="font-serif font-bold text-primary line-clamp-1 group-hover:text-accent transition-colors">{item.title}</h4>
                <p className="text-xs text-muted-foreground">{item.author}</p>
                <p className="text-sm font-bold text-primary mt-1">${item.price.toFixed(2)}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
