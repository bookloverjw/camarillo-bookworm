import React, { useEffect } from 'react';
import { Routes, Route, Link, Navigate, useLocation, useNavigate, BrowserRouter } from 'react-router';
import { Search, ShoppingCart, User, Menu, X, Instagram, Facebook, Twitter, MapPin, Phone, Mail, ChevronRight, ChevronDown, Star, Calendar as CalendarIcon, ArrowRight, Gift, ShoppingBag, Clock, Headphones, ExternalLink, Sun, Moon, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { getTodayHours, getFormattedHours } from '@/lib/storeHours';
import { STORE } from '@/lib/storeConfig';
import { usePageTracking } from '@/app/hooks/usePageTracking';
import { STORE_ORDERING_ENABLED } from '@/lib/features';

// Context & Auth
import { AuthProvider, useAuth } from '@/app/context/AuthContext';
import { CartProvider, useCart } from '@/app/context/CartContext';
import { ThemeProvider, useTheme } from '@/app/context/ThemeContext';
import { BookModalProvider } from '@/app/context/BookModalContext';
import { BookDetailModal } from '@/app/components/BookDetailModal';
import { ExternalBookModal } from '@/app/components/ExternalBookModal';
import { AuthPage } from '@/app/pages/auth/AuthPage';
import { AccountLayout } from '@/app/pages/account/AccountLayout';
import { DashboardPage } from '@/app/pages/account/DashboardPage';
import { WishlistPage } from '@/app/pages/account/WishlistPage';
import { OrderHistoryPage } from '@/app/pages/account/OrderHistoryPage';
import { SettingsPage } from '@/app/pages/account/SettingsPage';

// Pages
import { Home } from '@/app/pages/Home';
import { Shop } from '@/app/pages/Shop';
import { BookDetail } from '@/app/pages/BookDetail';
import { Events } from '@/app/pages/Events';
import { StaffPicks } from '@/app/pages/StaffPicks';
import { GiftCards } from '@/app/pages/GiftCards';
import { About } from '@/app/pages/About';
import { Contact } from '@/app/pages/Contact';
import { Newsletter } from '@/app/pages/Newsletter';
import { useNewsletterSignup } from '@/app/hooks/useNewsletterSignup';
import { ReadAlikes } from '@/app/pages/ReadAlikes';
import { Cart } from '@/app/pages/Cart';
import { Checkout } from '@/app/pages/Checkout';
import { Collections } from '@/app/pages/Collections';
import { CollectionPage } from '@/app/pages/CollectionPage';
import { AwardsPage } from '@/app/pages/AwardsPage';

const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [browseOpen, setBrowseOpen] = React.useState(false);
  const [mobileBrowseOpen, setMobileBrowseOpen] = React.useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { itemCount } = useCart();
  const { theme, toggleTheme } = useTheme();

  // Browse dropdown items
  const browseItems = [
    { name: 'All Books', path: '/shop', external: false },
    { name: 'New & Noteworthy', path: '/shop?filter=new', external: false },
    { name: 'Staff Picks', path: '/staff-picks', external: false },
    { name: 'Collections', path: '/collections', external: false },
    { name: 'Award Winners', path: '/collections/awards', external: false },
    { name: 'Banned Books', path: '/collections/banned-books', external: false },
    { name: 'The Book Was Better', path: '/collections/the-book-was-better', external: false },
    { name: 'Gift Cards', path: '/gift-cards', external: false },
    { name: 'Read-Alikes: What to Read Next', path: '/read-alikes', external: false, icon: BookOpen },
    { name: 'Audiobooks', path: 'https://libro.fm/camarillobookworm', external: true, icon: Headphones },
  ];

  const navLinks = [
    { name: 'Events', path: '/events' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <nav className="sticky top-0 z-50">
      {/* Main Header - Green background like Elliott Bay */}
      <div className="bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            {/* Set like the sign over the door: an italic "The", BOOKWORM in capitals */}
            <Link to="/" aria-label="The Bookworm - home" className="flex items-baseline gap-1.5 group font-serif text-white leading-tight whitespace-nowrap">
              <span className="logo-the text-[2rem] leading-none">The</span>
              <span className="text-2xl uppercase tracking-[0.08em]">Bookworm</span>
            </Link>

            {/* Search Bar - Desktop */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <form onSubmit={handleSearch} className="w-full">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search books, authors..."
                    className="w-full px-4 py-2 rounded text-foreground text-sm outline-none bg-white"
                  />
                  <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                    <Search size={18} />
                  </button>
                </div>
              </form>
            </div>

            {/* Icons - Desktop */}
            <div className="hidden md:flex items-center space-x-6">
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="text-white/90 hover:text-white transition-colors p-1"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              {/* Account */}
              <Link to={user ? "/account" : "/login"} className="flex items-center space-x-2 text-white/90 hover:text-white transition-colors">
                <User size={20} />
                <span className="text-sm">{user ? user.firstName : 'Sign In'}</span>
              </Link>

              {/* Cart - hidden while purchases go through Bookshop.org */}
              {STORE_ORDERING_ENABLED && (
              <Link to="/cart" className="flex items-center space-x-2 text-white/90 hover:text-white transition-colors relative">
                <ShoppingBag size={20} />
                <span className="text-sm">Cart</span>
                {itemCount > 0 && (
                  <motion.span
                    key={itemCount}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -left-2 bg-secondary text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                  >
                    {itemCount}
                  </motion.span>
                )}
              </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center space-x-4">
              {STORE_ORDERING_ENABLED && (
                <Link to="/cart" className="p-2 text-white relative">
                  <ShoppingBag size={20} />
                  {itemCount > 0 && (
                    <span className="absolute top-0 right-0 bg-secondary text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {itemCount}
                    </span>
                  )}
                </Link>
              )}
              <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-white">
                {isOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Nav - White background with green highlight on active */}
      <div className="hidden lg:block bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center space-x-1 py-0">
            {/* Browse Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setBrowseOpen(true)}
              onMouseLeave={() => setBrowseOpen(false)}
            >
              <button
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-1 ${
                  browseOpen
                    ? 'text-primary border-primary bg-primary/5'
                    : 'text-muted-foreground border-transparent hover:text-primary hover:border-primary/30'
                }`}
              >
                Browse
                <ChevronDown size={14} className={`transition-transform ${browseOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {browseOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 w-56 bg-white rounded-lg shadow-lg border border-border py-2 z-50"
                  >
                    {browseItems.map((item) => {
                      const Icon = item.icon;
                      if (item.external) {
                        return (
                          <a
                            key={item.name}
                            href={item.path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              {Icon && <Icon size={16} />}
                              {item.name}
                            </span>
                            <ExternalLink size={12} className="opacity-50" />
                          </a>
                        );
                      }
                      return (
                        <Link
                          key={item.name}
                          to={item.path}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                        >
                          {Icon && <Icon size={16} />}
                          {item.name}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {navLinks.map((link) => {
              const isActive = location.pathname === link.path ||
                (link.path.includes('?') && location.pathname + location.search === link.path);
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    isActive
                      ? 'text-primary border-primary bg-primary/5'
                      : 'text-muted-foreground border-transparent hover:text-primary hover:border-primary/30'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-b border-border overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              {/* Mobile Search */}
              <form onSubmit={handleSearch} className="px-3 py-4">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search books..."
                    className="w-full pl-10 pr-4 py-3 bg-muted rounded text-sm outline-none"
                  />
                </div>
              </form>

              {/* Mobile Browse Dropdown */}
              <div className="border-b border-border pb-2 mb-2">
                <button
                  onClick={() => setMobileBrowseOpen(!mobileBrowseOpen)}
                  className="flex items-center justify-between w-full px-3 py-3 text-base font-medium text-foreground hover:bg-muted rounded"
                >
                  <span>Browse</span>
                  <ChevronDown size={18} className={`transition-transform ${mobileBrowseOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {mobileBrowseOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-4 space-y-1">
                        {browseItems.map((item) => {
                          const Icon = item.icon;
                          if (item.external) {
                            return (
                              <a
                                key={item.name}
                                href={item.path}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center justify-between px-3 py-2.5 text-sm text-muted-foreground hover:text-primary hover:bg-muted rounded"
                              >
                                <span className="flex items-center gap-2">
                                  {Icon && <Icon size={16} />}
                                  {item.name}
                                </span>
                                <ExternalLink size={12} className="opacity-50" />
                              </a>
                            );
                          }
                          return (
                            <Link
                              key={item.name}
                              to={item.path}
                              onClick={() => setIsOpen(false)}
                              className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-primary hover:bg-muted rounded"
                            >
                              {Icon && <Icon size={16} />}
                              {item.name}
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-3 text-base font-medium text-foreground hover:bg-muted rounded"
                >
                  {link.name}
                </Link>
              ))}
              <div className="flex items-center justify-between px-3 py-4 border-t border-border mt-4">
                <Link to={user ? "/account" : "/login"} onClick={() => setIsOpen(false)} className="flex items-center space-x-2 text-primary">
                  <User size={20} />
                  <span>{user ? 'Account' : 'Sign In'}</span>
                </Link>
                <button
                  onClick={toggleTheme}
                  className="flex items-center space-x-2 text-primary"
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                  <span className="text-sm">{theme === 'dark' ? 'Light' : 'Dark'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Footer = () => {
  const { email, setEmail, isSubscribing, subscribe: handleNewsletterSubmit } = useNewsletterSignup('footer');

  return (
    <footer className="bg-primary text-white">
      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* About */}
          <div>
            <h3 className="font-serif text-xl font-normal mb-4"><span className="logo-the text-[1.7rem] leading-none">The</span> Bookworm</h3>
            <p className="text-sm text-white/70 leading-relaxed mb-4">
              Camarillo's independent bookstore since 1973.
            </p>
            <div className="flex space-x-3">
              <a href="https://instagram.com/camarillobookworm" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white transition-colors">
                <Instagram size={20} />
              </a>
              <a href="https://facebook.com/camarillobookworm" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white transition-colors">
                <Facebook size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-medium mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link to="/shop" className="text-sm text-white/70 hover:text-white transition-colors">Shop Books</Link></li>
              <li><Link to="/events" className="text-sm text-white/70 hover:text-white transition-colors">Events</Link></li>
              <li><Link to="/staff-picks" className="text-sm text-white/70 hover:text-white transition-colors">Staff Picks</Link></li>
              <li><Link to="/collections" className="text-sm text-white/70 hover:text-white transition-colors">Collections</Link></li>
              <li><Link to="/gift-cards" className="text-sm text-white/70 hover:text-white transition-colors">Gift Cards</Link></li>
              <li><a href="https://bookshop.org/shop/camarillobookworm" target="_blank" rel="noopener noreferrer" className="text-sm text-white/70 hover:text-white transition-colors">Bookshop.org</a></li>
              <li><a href="https://libro.fm/camarillobookworm" target="_blank" rel="noopener noreferrer" className="text-sm text-white/70 hover:text-white transition-colors">Libro.fm Audiobooks</a></li>
            </ul>
          </div>

          {/* Visit Us */}
          <div>
            <h4 className="text-sm font-medium mb-4">Visit Us</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="flex items-start space-x-2">
                <MapPin size={16} className="shrink-0 mt-0.5" />
                <a
                  href="https://maps.app.goo.gl/UGK8t2q3Etce2Q6P7"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors underline-offset-2 hover:underline"
                >
                  93 E Daily Dr<br/>Camarillo, CA 93010
                </a>
              </li>
              <li className="flex items-center space-x-2">
                <Phone size={16} className="shrink-0" />
                <a
                  href="tel:+18054821384"
                  className="hover:text-white transition-colors underline-offset-2 hover:underline"
                >
                  (805) 482-1384
                </a>
              </li>
              <li className="flex items-start space-x-2">
                <Clock size={16} className="shrink-0 mt-0.5" />
                <div>
                  {Object.entries(STORE.hours).map(([day, time]) => (
                    <p key={day}>{day}: {time}</p>
                  ))}
                </div>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-sm font-medium mb-4">Newsletter</h4>
            <p className="text-sm text-white/70 mb-4">
              Author events, book clubs and the week's new books. <Link to="/newsletter" className="underline hover:text-white">What you'll get</Link>
            </p>
            <form onSubmit={handleNewsletterSubmit} className="flex">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="bg-white/10 border border-white/20 px-3 py-2 rounded-l w-full text-sm outline-none focus:border-white/40 text-white placeholder:text-white/50"
              />
              <button
                type="submit"
                disabled={isSubscribing}
                className="bg-white text-primary px-4 py-2 rounded-r text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
              >
                {isSubscribing ? '...' : 'Join'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/50">© {new Date().getFullYear()} The Bookworm, Camarillo. All rights reserved.</p>
          <div className="flex space-x-6">
            <Link to="/privacy" className="text-xs text-white/50 hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="text-xs text-white/50 hover:text-white transition-colors">Terms</Link>
            <Link to="/contact" className="text-xs text-white/50 hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Announcement bar with dynamic hours
const AnnouncementBar = () => {
  const todayHours = getTodayHours();
  const { pathname } = useLocation();

  return (
    <div className="bg-muted text-muted-foreground py-2.5 px-4 text-sm flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      <span className="text-center">
        <span className="hidden sm:inline">Free local delivery in Camarillo on orders over $50 &nbsp;|&nbsp;{' '}</span>
        <span className={`font-medium ${todayHours.isOpen ? 'text-primary' : 'text-secondary'}`}>
          {todayHours.holidayName
            ? `Closed Today (${todayHours.holidayName})`
            : todayHours.isOpen
            ? `Open Today: ${todayHours.hours}`
            : `Closed Now (Hours: ${todayHours.hours})`}
        </span>
      </span>
      {pathname !== '/newsletter' && (
        <Link
          to="/newsletter"
          className="inline-flex items-center gap-1.5 bg-primary text-white px-3.5 py-1 rounded-full text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Mail size={13} />
          Get our newsletter
        </Link>
      )}
    </div>
  );
};

// Scroll to top on route change
const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
};

// Report route changes to Google Analytics (see src/lib/analytics.ts)
const AnalyticsTracker = () => {
  usePageTracking();

  return null;
};

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <CartProvider>
        <BookModalProvider>
        <BrowserRouter>
          <ScrollToTop />
          <AnalyticsTracker />
          <div className="min-h-screen flex flex-col font-sans selection:bg-accent/30 bg-background text-foreground">
            <AnnouncementBar />

            <Navbar />

            <main className="flex-grow">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/book/:id" element={<BookDetail />} />
                <Route path="/events" element={<Events />} />
                <Route path="/staff-picks" element={<StaffPicks />} />
                <Route path="/gift-cards" element={<GiftCards />} />
                <Route path="/about" element={<About />} />
                <Route path="/read-alikes" element={<ReadAlikes />} />
                <Route path="/collections" element={<Collections />} />
                <Route path="/collections/awards" element={<AwardsPage />} />
                <Route path="/collections/awards/:awardId" element={<AwardsPage />} />
                <Route path="/collections/:slug" element={<CollectionPage />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/newsletter" element={<Newsletter />} />
                {/* Store ordering is built but switched off - send anyone with an
                    old link back to the shop rather than a dead end. */}
                <Route path="/cart" element={STORE_ORDERING_ENABLED ? <Cart /> : <Navigate to="/shop" replace />} />
                <Route path="/checkout" element={STORE_ORDERING_ENABLED ? <Checkout /> : <Navigate to="/shop" replace />} />
                <Route path="/login" element={<AuthPage />} />

                {/* Account Routes */}
                <Route path="/account" element={<AccountLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="wishlist" element={<WishlistPage />} />
                  <Route path="orders" element={<OrderHistoryPage />} />
                  <Route path="addresses" element={<div className="p-12 text-center bg-white rounded-3xl border border-border mt-8">
                    <MapPin size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
                    <h3 className="text-xl font-serif font-bold text-primary mb-2">Saved Addresses</h3>
                    <p className="text-muted-foreground">Manage your shipping and billing locations.</p>
                  </div>} />
                  <Route path="payments" element={<div className="p-12 text-center bg-white rounded-3xl border border-border mt-8">
                    <Gift size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
                    <h3 className="text-xl font-serif font-bold text-primary mb-2">Payment Methods</h3>
                    <p className="text-muted-foreground">Securely store your payment information.</p>
                  </div>} />
                  <Route path="notifications" element={<div className="p-12 text-center bg-white rounded-3xl border border-border mt-8">
                    <Bell size={48} className="mx-auto text-muted-foreground mb-4 opacity-20" />
                    <h3 className="text-xl font-serif font-bold text-primary mb-2">Notifications</h3>
                    <p className="text-muted-foreground">Choose how you want to hear from us.</p>
                  </div>} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Routes>
            </main>

            <Footer />
            <BookDetailModal />
            <ExternalBookModal />
            <Toaster position="bottom-right" richColors />
          </div>
        </BrowserRouter>
        </BookModalProvider>
      </CartProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

const Bell = ({ size, className }: { size: number, className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
