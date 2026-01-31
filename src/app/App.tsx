import React from 'react';
import { Routes, Route, Link, useLocation, HashRouter } from 'react-router';
import { Search, ShoppingCart, User, Menu, X, Instagram, Facebook, Twitter, MapPin, Phone, Mail, ChevronRight, ChevronDown, Star, Calendar as CalendarIcon, ArrowRight, Gift, ShoppingBag, Clock, Headphones, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { getTodayHours, getFormattedHours } from '@/lib/storeHours';

// Context & Auth
import { AuthProvider, useAuth } from '@/app/context/AuthContext';
import { CartProvider, useCart } from '@/app/context/CartContext';
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
import { Cart } from '@/app/pages/Cart';
import { Checkout } from '@/app/pages/Checkout';

const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [browseOpen, setBrowseOpen] = React.useState(false);
  const [mobileBrowseOpen, setMobileBrowseOpen] = React.useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { itemCount } = useCart();

  // Browse dropdown items
  const browseItems = [
    { name: 'All Books', path: '/shop', external: false },
    { name: 'New & Noteworthy', path: '/shop?filter=new', external: false },
    { name: 'Staff Picks', path: '/staff-picks', external: false },
    { name: 'Gift Cards', path: '/gift-cards', external: false },
    { name: 'Audiobooks', path: 'https://libro.fm/camarillobookworm', external: true, icon: Headphones },
  ];

  const navLinks = [
    { name: 'Events', path: '/events' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `#/shop?search=${encodeURIComponent(searchQuery.trim())}`;
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
            <Link to="/" className="flex items-center space-x-3 group">
              <span className="font-serif text-2xl font-normal text-white leading-tight">Camarillo Bookworm</span>
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
              {/* Account */}
              <Link to={user ? "/account" : "/login"} className="flex items-center space-x-2 text-white/90 hover:text-white transition-colors">
                <User size={20} />
                <span className="text-sm">{user ? user.firstName : 'Sign In'}</span>
              </Link>

              {/* Cart */}
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
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center space-x-4">
              <Link to="/cart" className="p-2 text-white relative">
                <ShoppingBag size={20} />
                {itemCount > 0 && (
                  <span className="absolute top-0 right-0 bg-secondary text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {itemCount}
                  </span>
                )}
              </Link>
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
              <div className="flex items-center space-x-4 px-3 py-4 border-t border-border mt-4">
                <Link to={user ? "/account" : "/login"} onClick={() => setIsOpen(false)} className="flex items-center space-x-2 text-primary">
                  <User size={20} />
                  <span>{user ? 'Account' : 'Sign In'}</span>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Footer = () => {
  const [email, setEmail] = React.useState('');
  const [isSubscribing, setIsSubscribing] = React.useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubscribing(true);
    try {
      // Import supabase here to avoid circular dependencies
      const { supabase } = await import('@/lib/supabase');

      const { error } = await supabase.from('newsletter_subscribers').insert({
        email: email.trim(),
        source: 'footer',
        subscribed_at: new Date().toISOString(),
        is_active: true,
      });

      if (error) {
        if (error.code === '23505') {
          toast.info("You're already subscribed!");
        } else {
          throw error;
        }
      } else {
        toast.success('Welcome to our newsletter!');
        setEmail('');
      }
    } catch (err) {
      toast.error('Failed to subscribe. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <footer className="bg-primary text-white">
      {/* Main footer content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* About */}
          <div>
            <h3 className="font-serif text-xl font-normal mb-4">Camarillo Bookworm</h3>
            <p className="text-sm text-white/70 leading-relaxed mb-4">
              Your neighborhood independent bookstore since 1973.
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
                <span>123 Mission Oaks Blvd<br/>Camarillo, CA 93012</span>
              </li>
              <li className="flex items-center space-x-2">
                <Phone size={16} className="shrink-0" />
                <span>(805) 555-0123</span>
              </li>
              <li className="flex items-start space-x-2">
                <Clock size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p>Mon-Fri: 10am - 6pm</p>
                  <p>Sat: 10am - 5pm</p>
                  <p>Sun: 12pm - 5pm</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-sm font-medium mb-4">Newsletter</h4>
            <p className="text-sm text-white/70 mb-4">Weekly recommendations & event updates.</p>
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
          <p className="text-xs text-white/50">© 2026 Camarillo Bookworm. All rights reserved.</p>
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

  return (
    <div className="bg-muted text-muted-foreground py-2 px-4 text-center text-xs">
      Free local delivery in Camarillo on orders over $50 &nbsp;|&nbsp;{' '}
      <span className={`font-medium ${todayHours.isOpen ? 'text-primary' : 'text-secondary'}`}>
        {todayHours.holidayName
          ? `Closed Today (${todayHours.holidayName})`
          : todayHours.isOpen
          ? `Open Today: ${todayHours.hours}`
          : `Closed Now (Hours: ${todayHours.hours})`}
      </span>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <HashRouter>
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
                <Route path="/contact" element={<Contact />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
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
            <Toaster position="bottom-right" richColors />
          </div>
        </HashRouter>
      </CartProvider>
    </AuthProvider>
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
