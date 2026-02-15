import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, Search, ChevronLeft, ChevronRight, ShoppingBag, ExternalLink, Grid, List as ListIcon, X, Loader2, Headphones, Calendar } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { type Book } from '@/app/utils/data';
import { getBooks, getBooksCount, type SortOption, type BookQueryOptions } from '@/lib/bookService';
import { getLibroFmUrl } from '@/lib/bookshopWidgets';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

const BISAC_GENRES: Record<string, string[]> = {
  'Fiction': ['All Fiction', 'Literary', 'Graphic Novels', 'Mystery', 'Thriller', 'Romance', 'Sci-Fi', 'Fantasy', 'Historical', 'Contemporary'],
  'Nonfiction': ['All Nonfiction', 'Biography', 'Cooking', 'History', 'Self-Help', 'Science', 'True Crime', 'Religion', 'Art'],
  'Kids': ['All Kids', 'Picture Books', 'Graphic Novels', 'Early Readers', 'Middle Grade', 'Nonfiction'],
  'YA': ['All YA', 'Graphic Novels', 'Contemporary', 'Fantasy', 'Sci-Fi', 'Dystopian', 'Romance']
};

interface KidsTopic {
  label: string;
  emoji: string;
  keywords: string[];
}

const KIDS_TOPICS: KidsTopic[] = [
  { label: 'Dinosaurs & Dragons', emoji: '🦕', keywords: ['dinosaur', 'dragon', 'dino', 'T-Rex', 'prehistoric'] },
  { label: 'Cars & Trucks', emoji: '🚗', keywords: ['car', 'truck', 'vehicle', 'race', 'tractor', 'train', 'bus'] },
  { label: 'Animals & Pets', emoji: '🐾', keywords: ['animal', 'dog', 'cat', 'pet', 'puppy', 'kitten', 'bunny', 'farm', 'zoo'] },
  { label: 'Space & Rockets', emoji: '🚀', keywords: ['space', 'rocket', 'planet', 'moon', 'star', 'astronaut', 'galaxy'] },
  { label: 'Fairies & Magic', emoji: '✨', keywords: ['fairy', 'fairies', 'magic', 'magical', 'wizard', 'witch', 'enchant'] },
  { label: 'Princesses & Royalty', emoji: '👑', keywords: ['princess', 'prince', 'queen', 'king', 'castle', 'royal', 'crown'] },
  { label: 'Pirates & Adventure', emoji: '🏴\u200D☠️', keywords: ['pirate', 'adventure', 'treasure', 'explorer', 'quest'] },
  { label: 'Ocean & Sea Life', emoji: '🐠', keywords: ['ocean', 'sea', 'fish', 'whale', 'shark', 'mermaid', 'dolphin'] },
  { label: 'Superheroes', emoji: '🦸', keywords: ['superhero', 'hero', 'super power', 'cape', 'rescue'] },
  { label: 'Bugs & Nature', emoji: '🦋', keywords: ['bug', 'insect', 'butterfly', 'bee', 'nature', 'garden', 'flower'] },
  { label: 'Sports & Games', emoji: '⚽', keywords: ['sport', 'soccer', 'baseball', 'basketball', 'football', 'game'] },
  { label: 'Art & Creativity', emoji: '🎨', keywords: ['art', 'draw', 'paint', 'color', 'craft', 'creative', 'music'] },
];

const FilterContent = ({
  activeCategory,
  setActiveCategory,
  activeGenre,
  setActiveGenre,
  activeFormat,
  setActiveFormat,
  activeTopic,
  setActiveTopic,
  priceRange,
  setPriceRange,
  availabilityFilters,
  setAvailabilityFilters,
  categories,
  formats,
  onFilterChange
}: any) => (
  <div className="space-y-10">
    <div>
      <h3 className="text-lg font-bold text-primary mb-6 flex items-center">
        <Filter size={20} className="mr-2 text-accent" /> Browse
      </h3>

      <div className="space-y-8">
        {/* Category Selection */}
        <div>
          <div className="flex justify-between items-end mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Department</p>
            {activeCategory !== 'All' && (
              <button
                onClick={() => { setActiveCategory('All'); setActiveGenre('All'); setActiveTopic(null); }}
                className="text-[9px] font-bold text-accent uppercase tracking-widest hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat: string) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setActiveGenre('All ' + cat);
                  if (cat !== 'Kids') setActiveTopic(null);
                  onFilterChange?.();
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  activeCategory === cat
                    ? 'bg-primary text-white border-primary shadow-md'
                    : 'bg-white text-muted-foreground border-border hover:border-primary/30'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Genre Selection */}
        {activeCategory !== 'All' && BISAC_GENRES[activeCategory] && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pt-2"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Genre / Subject</p>
            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {BISAC_GENRES[activeCategory].map((genre: string) => (
                <button
                  key={genre}
                  onClick={() => {
                    setActiveGenre(genre);
                    onFilterChange?.();
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    activeGenre === genre
                      ? 'bg-accent/10 text-accent font-bold border-l-2 border-accent'
                      : 'text-muted-foreground hover:bg-muted hover:text-primary'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Kids Topics */}
        {activeCategory === 'Kids' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex justify-between items-end mb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Shop by Topic</p>
              {activeTopic && (
                <button
                  onClick={() => { setActiveTopic(null); onFilterChange?.(); }}
                  className="text-[9px] font-bold text-accent uppercase tracking-widest hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {KIDS_TOPICS.map((topic) => (
                <button
                  key={topic.label}
                  onClick={() => {
                    setActiveTopic(activeTopic?.label === topic.label ? null : topic);
                    onFilterChange?.();
                  }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    activeTopic?.label === topic.label
                      ? 'bg-primary text-white border-primary shadow-md'
                      : 'bg-white text-muted-foreground border-border hover:border-primary/30 hover:bg-muted/50'
                  }`}
                >
                  <span className="text-base">{topic.emoji}</span>
                  <span className="leading-tight text-left">{topic.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Format */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Format</p>
          <div className="space-y-1">
            {formats.map((format: string) => (
              <button
                key={format}
                onClick={() => {
                  setActiveFormat(format);
                  onFilterChange?.();
                }}
                className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                  activeFormat === format
                    ? 'bg-primary text-white font-bold shadow-md shadow-primary/20 translate-x-1'
                    : 'text-muted-foreground hover:bg-muted hover:text-primary'
                }`}
              >
                {format}
              </button>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Price Range</p>
          <div className="space-y-4 px-1">
            {/* Dual-thumb range slider */}
            <div className="relative h-6 flex items-center">
              {/* Track background */}
              <div className="absolute w-full h-1.5 bg-border rounded-full" />
              {/* Active range highlight */}
              <div
                className="absolute h-1.5 bg-accent rounded-full"
                style={{
                  left: `${priceRange[0]}%`,
                  right: `${100 - priceRange[1]}%`,
                }}
              />
              {/* Min thumb */}
              <input
                type="range"
                min="0"
                max="100"
                value={priceRange[0]}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPriceRange([Math.min(val, priceRange[1] - 1), priceRange[1]]);
                }}
                className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                style={{ zIndex: priceRange[0] > 50 ? 5 : 3 }}
              />
              {/* Max thumb */}
              <input
                type="range"
                min="0"
                max="100"
                value={priceRange[1]}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPriceRange([priceRange[0], Math.max(val, priceRange[0] + 1)]);
                }}
                className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                style={{ zIndex: 4 }}
              />
            </div>
            {/* Min / Max number inputs */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1 block">Min</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <input
                    type="number"
                    min="0"
                    max={priceRange[1]}
                    value={priceRange[0]}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(Number(e.target.value) || 0, priceRange[1] - 1));
                      setPriceRange([val, priceRange[1]]);
                    }}
                    className="w-full pl-6 pr-2 py-1.5 text-sm bg-white border border-border rounded-lg outline-none focus:ring-1 focus:ring-accent text-primary font-bold"
                  />
                </div>
              </div>
              <span className="text-muted-foreground mt-5">–</span>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1 block">Max</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <input
                    type="number"
                    min={priceRange[0]}
                    max="100"
                    value={priceRange[1]}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(Number(e.target.value) || 0, priceRange[0] + 1));
                      setPriceRange([priceRange[0], val]);
                    }}
                    className="w-full pl-6 pr-2 py-1.5 text-sm bg-white border border-border rounded-lg outline-none focus:ring-1 focus:ring-accent text-primary font-bold"
                  />
                </div>
              </div>
            </div>
            {(priceRange[0] > 0 || priceRange[1] < 100) && (
              <button
                onClick={() => setPriceRange([0, 100])}
                className="text-[9px] font-bold text-accent uppercase tracking-widest hover:underline"
              >
                Reset price
              </button>
            )}
          </div>
        </div>

        {/* Availability */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">Availability</p>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 text-sm text-muted-foreground cursor-pointer group">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                checked={availabilityFilters.inStock}
                onChange={(e) => setAvailabilityFilters({ ...availabilityFilters, inStock: e.target.checked })}
              />
              <span className="group-hover:text-primary transition-colors">In Stock at Store</span>
            </label>
            <label className="flex items-center space-x-3 text-sm text-muted-foreground cursor-pointer group">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                checked={availabilityFilters.preorder}
                onChange={(e) => setAvailabilityFilters({ ...availabilityFilters, preorder: e.target.checked })}
              />
              <span className="group-hover:text-primary transition-colors">Online Preorder</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div className="bg-muted p-6 rounded-2xl border border-border">
      <h4 className="font-bold text-primary mb-2">Staff Recommendations</h4>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Sign up for our monthly "Bookworm Buzz" newsletter for hand-picked gems.</p>
      <input type="email" placeholder="Email address" className="w-full px-4 py-2 text-sm bg-white border border-border rounded-lg mb-2 outline-none focus:ring-1 focus:ring-accent" />
      <button className="w-full bg-accent text-white py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-accent/90 transition-colors">Subscribe</button>
    </div>
  </div>
);

const ITEMS_PER_PAGE_OPTIONS = [12, 24, 48, 96];

export const Shop = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  const categoryParam = searchParams.get('category');
  const genreParam = searchParams.get('genre');

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeCategory, setActiveCategory] = useState<string>(
    categoryParam || (filterParam === 'new' ? 'Fiction' : 'All')
  );
  const [activeGenre, setActiveGenre] = useState<string>(
    genreParam || (filterParam === 'new' ? 'All Fiction' : 'All')
  );
  const [activeFormat, setActiveFormat] = useState<string>('All');
  const [activeTopic, setActiveTopic] = useState<KidsTopic | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [newestTab, setNewestTab] = useState<'released' | 'preorders'>('released');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100]);
  const [availabilityFilters, setAvailabilityFilters] = useState({ inStock: false, preorder: false });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const [totalItems, setTotalItems] = useState(0);

  // Fetch books from database
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Build query options from all filter state
  const buildFilterOptions = useCallback((): BookQueryOptions => {
    const options: BookQueryOptions = {
      limit: itemsPerPage,
      offset: (currentPage - 1) * itemsPerPage,
      search: searchQuery || undefined,
      category: activeCategory !== 'All' ? activeCategory : undefined,
      genre: activeGenre,
      format: activeFormat !== 'All' ? activeFormat : undefined,
      sortBy,
      topicKeywords: activeTopic ? activeTopic.keywords : undefined,
      hideStaleHardcovers: true,
    };

    // Price range
    if (priceRange[0] > 0) options.priceMin = priceRange[0];
    if (priceRange[1] < 100) options.priceMax = priceRange[1];

    // Availability filters
    if (availabilityFilters.inStock) options.inStockOnly = true;
    if (availabilityFilters.preorder) options.preorderOnly = true;

    // Newest arrivals with preorder tab
    if (sortBy === 'newest' && newestTab === 'preorders') {
      options.preorderOnly = true;
    }

    return options;
  }, [currentPage, itemsPerPage, searchQuery, activeCategory, activeGenre, activeFormat, activeTopic, sortBy, newestTab, priceRange, availabilityFilters]);

  // Load books from Supabase with pagination
  const loadBooks = useCallback(async () => {
    setIsLoading(true);
    try {
      const filterOptions = buildFilterOptions();

      // Fetch books and count in parallel
      const [fetchedBooks, count] = await Promise.all([
        getBooks(filterOptions),
        getBooksCount(filterOptions)
      ]);

      setBooks(fetchedBooks);
      setTotalItems(count);
    } catch (error) {
      console.error('Failed to fetch books:', error);
      setBooks([]);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
    }
  }, [buildFilterOptions]);

  // Load books when filters or pagination changes
  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeCategory, activeGenre, activeFormat, activeTopic, sortBy, newestTab, priceRange, availabilityFilters]);

  // Handle page change
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Handle items per page change
  const handleItemsPerPageChange = (newValue: number) => {
    setItemsPerPage(newValue);
    setCurrentPage(1);
  };

  const categories = ['Fiction', 'Nonfiction', 'Kids', 'YA'];
  const formats = ['All', 'Hardcover', 'Paperback', 'Audiobook'];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'In Stock': return 'bg-green-50 text-green-700 border-green-100';
      case 'Low Stock': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'Preorder': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'Preorder Closed': return 'bg-gray-50 text-gray-500 border-gray-200';
      case 'Ships in X days': return 'bg-blue-50 text-blue-700 border-blue-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Mobile Filter Toggle */}
      <div className="lg:hidden mb-8">
        <button
          onClick={() => setShowMobileFilters(true)}
          className="w-full flex items-center justify-between bg-white border-2 border-primary text-primary px-6 py-4 rounded-2xl font-bold shadow-sm active:scale-[0.98] transition-all"
        >
          <div className="flex items-center space-x-3">
            <Filter size={20} className="text-accent" />
            <span>Filters & Categories</span>
          </div>
          <div className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest">
            {activeCategory !== 'All' || activeFormat !== 'All' || activeTopic || availabilityFilters.inStock || availabilityFilters.preorder ? 'Active' : 'All'}
          </div>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden lg:block w-64 shrink-0">
          <FilterContent
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            activeGenre={activeGenre}
            setActiveGenre={setActiveGenre}
            activeFormat={activeFormat}
            setActiveFormat={setActiveFormat}
            activeTopic={activeTopic}
            setActiveTopic={setActiveTopic}
            priceRange={priceRange}
            setPriceRange={setPriceRange}
            availabilityFilters={availabilityFilters}
            setAvailabilityFilters={setAvailabilityFilters}
            categories={categories}
            formats={formats}
          />
        </aside>

        {/* Mobile Filters Drawer */}
        <AnimatePresence>
          {showMobileFilters && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMobileFilters(false)}
                className="fixed inset-0 bg-black/60 z-[100] lg:hidden backdrop-blur-sm"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 w-[85%] max-w-sm bg-white z-[101] lg:hidden shadow-2xl p-8 overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-10 border-b border-border pb-4">
                  <div>
                    <h3 className="text-2xl font-serif font-bold text-primary">Browse Books</h3>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Refine your search</p>
                  </div>
                  <button onClick={() => setShowMobileFilters(false)} className="p-2 bg-muted rounded-full text-muted-foreground hover:text-primary transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <FilterContent
                  activeCategory={activeCategory}
                  setActiveCategory={setActiveCategory}
                  activeGenre={activeGenre}
                  setActiveGenre={setActiveGenre}
                  activeFormat={activeFormat}
                  setActiveFormat={setActiveFormat}
                  activeTopic={activeTopic}
                  setActiveTopic={setActiveTopic}
                  priceRange={priceRange}
                  setPriceRange={setPriceRange}
                  availabilityFilters={availabilityFilters}
                  setAvailabilityFilters={setAvailabilityFilters}
                  categories={categories}
                  formats={formats}
                  onFilterChange={() => setShowMobileFilters(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1">
          {/* Top Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 pb-8 border-b border-border">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                type="text"
                placeholder="Search by title, author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-muted/30 border border-border rounded-2xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="flex items-center justify-between md:justify-end gap-4">
              {/* Records per page selector */}
              <div className="flex items-center text-sm">
                <span className="text-muted-foreground mr-2 hidden sm:inline">Show:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="bg-muted/50 border border-border rounded-lg px-3 py-2 outline-none text-primary font-bold cursor-pointer text-sm"
                >
                  {ITEMS_PER_PAGE_OPTIONS.map(option => (
                    <option key={option} value={option}>{option} per page</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center text-sm">
                <span className="text-muted-foreground mr-2 hidden sm:inline">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-muted/50 border border-border rounded-lg px-3 py-2 outline-none text-primary font-bold cursor-pointer text-sm"
                >
                  <option value="newest">Newest Arrivals</option>
                  <option value="best-selling">Bestsellers</option>
                  <option value="author">Author</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="alphabetical">Alphabetical</option>
                </select>
              </div>
              <div className="flex items-center bg-muted rounded-xl p-1.5 border border-border shadow-inner">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-primary'}`}>
                  <Grid size={18} />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-primary'}`}>
                  <ListIcon size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Newest Arrivals toggle: Released vs Preorders */}
          {sortBy === 'newest' && (
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setNewestTab('released')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  newestTab === 'released'
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-muted text-muted-foreground hover:text-primary'
                }`}
              >
                Released
              </button>
              <button
                onClick={() => setNewestTab('preorders')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  newestTab === 'preorders'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-muted text-muted-foreground hover:text-primary'
                }`}
              >
                Preorders
              </button>
            </div>
          )}

          {/* Active filter chips */}
          {(() => {
            const chips: { label: string; onClear: () => void }[] = [];
            if (activeCategory !== 'All') chips.push({ label: activeCategory, onClear: () => { setActiveCategory('All'); setActiveGenre('All'); setActiveTopic(null); } });
            if (activeGenre !== 'All' && !activeGenre.startsWith('All ')) chips.push({ label: activeGenre, onClear: () => setActiveGenre(activeCategory !== 'All' ? 'All ' + activeCategory : 'All') });
            if (activeTopic) chips.push({ label: activeTopic.emoji + ' ' + activeTopic.label, onClear: () => setActiveTopic(null) });
            if (activeFormat !== 'All') chips.push({ label: activeFormat, onClear: () => setActiveFormat('All') });
            if (priceRange[0] > 0 || priceRange[1] < 100) chips.push({ label: `$${priceRange[0]}–${priceRange[1] >= 100 ? '$100+' : '$' + priceRange[1]}`, onClear: () => setPriceRange([0, 100]) });
            if (availabilityFilters.inStock) chips.push({ label: 'In Stock', onClear: () => setAvailabilityFilters({ ...availabilityFilters, inStock: false }) });
            if (availabilityFilters.preorder) chips.push({ label: 'Preorder', onClear: () => setAvailabilityFilters({ ...availabilityFilters, preorder: false }) });
            if (searchQuery) chips.push({ label: `"${searchQuery}"`, onClear: () => setSearchQuery('') });

            if (chips.length === 0) return null;

            return (
              <div className="flex flex-wrap items-center gap-2 mb-6">
                {chips.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={chip.onClear}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent text-xs font-bold rounded-full hover:bg-accent/20 transition-colors group"
                  >
                    <span>{chip.label}</span>
                    <X size={12} className="opacity-60 group-hover:opacity-100" />
                  </button>
                ))}
                {chips.length > 1 && (
                  <button
                    onClick={() => {
                      setActiveCategory('All');
                      setActiveGenre('All');
                      setActiveFormat('All');
                      setActiveTopic(null);
                      setSearchQuery('');
                      setPriceRange([0, 100]);
                      setAvailabilityFilters({ inStock: false, preorder: false });
                    }}
                    className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary ml-1"
                  >
                    Clear all
                  </button>
                )}
              </div>
            );
          })()}

          {/* Results count */}
          <div className="mb-6 text-sm text-muted-foreground">
            {isLoading ? (
              <span>Loading...</span>
            ) : totalItems === 0 ? (
              <span>No books found</span>
            ) : (
              <span>
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} books
              </span>
            )}
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="animate-spin text-primary mr-3" size={32} />
              <span className="text-muted-foreground">Loading books...</span>
            </div>
          )}

          {!isLoading && <div className={`grid ${viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12' : 'grid-cols-1 gap-4'}`}>
            {books.map(book => (
              <motion.div
                key={book.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group ${viewMode === 'list'
                  ? 'flex flex-col sm:flex-row gap-6 p-4 bg-white rounded-2xl border border-border hover:shadow-lg transition-all items-center sm:items-stretch'
                  : 'flex flex-col'}`}
              >
                <Link to={`/book/${book.id}`} className={viewMode === 'list' ? 'w-full sm:w-28 shrink-0' : 'block'}>
                  <div className={`relative aspect-[2/3] overflow-hidden rounded-xl shadow-lg transition-all group-hover:-translate-y-1 group-hover:shadow-xl bg-black ${viewMode === 'list' ? 'm-0' : 'mb-5'}`}>
                    <ImageWithFallback src={book.cover} alt={book.title} className="w-full h-full object-contain" />
                    <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[8px] font-bold border backdrop-blur-md uppercase tracking-widest ${getStatusBadge(book.status)}`}>
                      {book.status}
                    </div>
                  </div>
                </Link>

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <Link to={`/book/${book.id}`}>
                      <h3 className={`font-serif font-bold text-primary group-hover:text-accent transition-colors leading-tight line-clamp-2 ${viewMode === 'list' ? 'text-base mb-1' : 'text-lg mb-1.5'}`}>{book.title}</h3>
                    </Link>
                    {book.subtitle && (
                      <p className={`text-muted-foreground font-serif leading-snug line-clamp-1 ${viewMode === 'list' ? 'text-sm mb-1' : 'text-xs mb-1'}`}>{book.subtitle}</p>
                    )}
                    {book.author && <p className="text-muted-foreground text-xs mb-2 italic">by {book.author}</p>}

                    <div className={`flex items-baseline space-x-2 ${viewMode === 'list' ? 'mb-4' : 'mb-6'}`}>
                      <p className="text-primary font-bold text-lg">${book.price.toFixed(2)}</p>
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">{book.type}</span>
                    </div>
                  </div>

                  {book.status === 'Preorder Closed' ? (
                    /* Limited preorder window has closed */
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-center space-x-2 bg-gray-100 text-gray-400 py-2 rounded-xl text-xs font-bold w-full cursor-not-allowed">
                        <Calendar size={14} />
                        <span>Preorder Closed</span>
                      </div>
                      {book.preorderCutoffDate && (
                        <p className="text-[10px] text-muted-foreground text-center">
                          Preorder ended {new Date(book.preorderCutoffDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  ) : book.status === 'Ships in X days' ? (
                    /* Out of stock — promote Bookshop as faster option */
                    <div className={`flex flex-col gap-1.5`}>
                      <a
                        href={book.isbn ? `https://bookshop.org/a/camarillobookworm/${book.isbn}` : `https://bookshop.org/shop/camarillobookworm`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-center space-x-2 bg-primary text-white py-2 rounded-xl text-xs font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/10 w-full`}
                      >
                        <ExternalLink size={14} />
                        <span>Order on Bookshop</span>
                      </a>
                      <a
                        href={getLibroFmUrl(book.title)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center space-x-1 text-[10px] text-muted-foreground hover:text-primary transition-colors py-0.5"
                      >
                        <Headphones size={10} />
                        <span>Audiobook on Libro.fm</span>
                      </a>
                    </div>
                  ) : (
                    /* In stock / low stock / preorder — our store is primary */
                    <div className={`flex flex-col gap-1.5`}>
                      <button className={`flex items-center justify-center space-x-2 bg-primary text-white py-2 rounded-xl text-xs font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/10 w-full`}>
                        <ShoppingBag size={14} />
                        <span>Add to Bag</span>
                      </button>
                      {book.status === 'Preorder' && book.isLimitedPreorder && book.preorderCutoffDate && (
                        <p className="text-[10px] text-purple-600 font-medium text-center">
                          Preorder by {new Date(book.preorderCutoffDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                      <div className="flex items-center justify-center gap-2 py-0.5">
                        <a
                          href={book.isbn ? `https://bookshop.org/a/camarillobookworm/${book.isbn}` : `https://bookshop.org/shop/camarillobookworm`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink size={10} />
                          <span>Bookshop</span>
                        </a>
                        <span className="text-border text-[10px]">|</span>
                        <a
                          href={getLibroFmUrl(book.title)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Headphones size={10} />
                          <span>Libro.fm</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>}

          {!isLoading && books.length === 0 && (
            <div className="text-center py-32 bg-muted/20 rounded-3xl border border-dashed border-border">
              <Search size={48} className="mx-auto text-muted-foreground mb-6 opacity-20" />
              <h3 className="text-2xl font-serif font-bold text-primary mb-3">No results found</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mb-8">We couldn't find any books matching your criteria. Try adjusting your filters or search term.</p>
              <button
                onClick={() => {
                  setActiveCategory('All');
                  setActiveGenre('All');
                  setActiveFormat('All');
                  setActiveTopic(null);
                  setSearchQuery('');
                  setPriceRange([0, 100]);
                  setAvailabilityFilters({ inStock: false, preorder: false });
                }}
                className="bg-primary text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && books.length > 0 && totalPages > 1 && (
            <div className="mt-24 pt-12 border-t border-border flex flex-col sm:flex-row justify-center items-center gap-6">
              <div className="flex items-center space-x-2">
                {/* Previous button */}
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-3 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>

                {/* Page numbers */}
                {(() => {
                  const pages = [];
                  const showEllipsisStart = currentPage > 3;
                  const showEllipsisEnd = currentPage < totalPages - 2;

                  // Always show first page
                  pages.push(1);

                  if (showEllipsisStart) {
                    pages.push('...');
                  }

                  // Show pages around current page
                  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                    if (!pages.includes(i)) {
                      pages.push(i);
                    }
                  }

                  if (showEllipsisEnd) {
                    pages.push('...');
                  }

                  // Always show last page if more than 1 page
                  if (totalPages > 1 && !pages.includes(totalPages)) {
                    pages.push(totalPages);
                  }

                  return pages.map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground font-bold">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => goToPage(page as number)}
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl text-sm font-bold transition-all ${
                          currentPage === page
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'text-muted-foreground hover:bg-muted hover:text-primary'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  ));
                })()}

                {/* Next button */}
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-3 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Page info */}
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
