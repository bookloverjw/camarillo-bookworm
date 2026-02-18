/**
 * Book Service
 * Fetches books from Supabase (synced from BookMagic POS)
 */

import { supabase } from './supabase';
import { type Book } from '@/app/utils/data';
import { splitTitle } from './titleUtils';

export type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'alphabetical' | 'author' | 'best-selling';
export type BestsellerPeriod = 'month' | 'quarter' | 'year';
export type BestsellerCategory = 'all' | 'fiction' | 'nonfiction' | 'ya' | 'children' | 'picture-books';

export interface BookQueryOptions {
  category?: string;
  genre?: string;
  format?: string;
  inStockOnly?: boolean;
  staffPicksOnly?: boolean;
  preorderOnly?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: SortOption;
  priceMin?: number;
  priceMax?: number;
  topicKeywords?: string[];
  hideStaleHardcovers?: boolean;
  bestsellerPeriod?: BestsellerPeriod;
  bestsellerCategory?: BestsellerCategory;
}

export interface SupabaseBook {
  id: string;
  isbn: string;
  title: string;
  author: string;
  description: string | null;
  price: number;
  cost: number | null;
  cover_url: string | null;
  category: string | null;
  genre: string | null;
  book_type: string | null;
  publisher: string | null;
  publication_date: string | null;
  page_count: number | null;
  inventory_count: number;
  reserved_count: number;
  status: string | null;
  is_staff_pick: boolean;
  staff_reviewer: string | null;
  staff_quote: string | null;
  author_last: string | null;
  is_limited_preorder: boolean;
  preorder_cutoff_date: string | null;
  total_sold: number;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

/**
 * Map Supabase book to website Book format
 */
function mapSupabaseBookToBook(sb: SupabaseBook): Book {
  const { title, subtitle } = splitTitle(sb.title);
  return {
    id: sb.id,
    isbn: sb.isbn,
    title,
    subtitle,
    author: sb.author_last ? sb.author : '',
    price: sb.price || 0,
    cover: sb.cover_url || 'https://images.unsplash.com/photo-1538981457319-5e459479f9d0?auto=format&fit=crop&q=80&w=600',
    category: (sb.category as Book['category']) || 'Fiction',
    genre: sb.genre || 'Literary',
    type: (sb.book_type as Book['type']) || 'Paperback',
    status: mapStatus(sb.status, sb.inventory_count, sb.is_limited_preorder, sb.preorder_cutoff_date),
    releaseDate: sb.publication_date || undefined,
    isLimitedPreorder: sb.is_limited_preorder || false,
    preorderCutoffDate: sb.preorder_cutoff_date || undefined,
    tags: sb.tags || undefined,
    description: sb.description || '',
    isStaffPick: sb.is_staff_pick,
    staffReviewer: sb.staff_reviewer || undefined,
    staffQuote: sb.staff_quote || undefined,
  };
}

/**
 * Map database status to website status.
 *
 * Status values shown to customers:
 *   "In Store"           – at least 2 copies in inventory
 *   "Only 1 Left"        – exactly 1 copy remaining (creates urgency)
 *   "Available to Order" – 0 inventory but can be ordered
 *   "Preorder"           – upcoming title
 *   "Preorder Closed"    – limited preorder whose cutoff has passed
 *   "Unavailable"        – withdrawn, discontinued, or inactive
 */
function mapStatus(
  status: string | null,
  inventoryCount: number,
  isLimitedPreorder?: boolean,
  preorderCutoffDate?: string | null,
): Book['status'] {
  const lower = (status || '').toLowerCase();

  // Withdrawn / inactive books from POS
  if (lower.includes('withdrawn') || lower.includes('inactive') || lower.includes('discontinued') || lower.includes('removed')) {
    return 'Unavailable';
  }

  // Preorder logic
  if (lower === 'preorder') {
    if (isLimitedPreorder && preorderCutoffDate) {
      const cutoff = new Date(preorderCutoffDate);
      if (new Date() > cutoff) return 'Preorder Closed';
    }
    return 'Preorder';
  }

  // Inventory-based status
  if (inventoryCount <= 0) return 'Available to Order';
  if (inventoryCount === 1) return 'Only 1 Left';
  return 'In Store';
}

/**
 * Strip leading articles ("A ", "An ", "The ") for alphabetical sorting
 */
function sortKeyForTitle(title: string): string {
  return title.replace(/^(the|a|an)\s+/i, '').toLowerCase();
}

/**
 * Build shared Supabase filter query used by both getBooks and getBooksCount.
 */
function applyFilters(query: any, options?: BookQueryOptions) {
  if (options?.category && options.category !== 'All') {
    query = query.eq('category', options.category);
  }
  if (options?.genre && options.genre !== 'All' && !options.genre.startsWith('All ')) {
    query = query.eq('genre', options.genre);
  }
  if (options?.format && options.format !== 'All') {
    query = query.eq('book_type', options.format);
  }
  if (options?.inStockOnly) {
    query = query.gt('inventory_count', 0);
  }
  if (options?.staffPicksOnly) {
    query = query.eq('is_staff_pick', true);
  }
  if (options?.preorderOnly) {
    query = query.or('status.eq.Preorder,status.eq.preorder');
  }
  if (options?.search) {
    const searchTerm = `%${options.search}%`;
    query = query.or(`title.ilike.${searchTerm},author.ilike.${searchTerm}`);
  }
  if (options?.priceMin !== undefined && options.priceMin > 0) {
    query = query.gte('price', options.priceMin);
  }
  if (options?.priceMax !== undefined && options.priceMax < 100) {
    query = query.lte('price', options.priceMax);
  }
  if (options?.topicKeywords && options.topicKeywords.length > 0) {
    // Match books by tags array (if populated) OR keyword search in title/description
    const conditions = options.topicKeywords.flatMap(kw => [
      `title.ilike.%${kw}%`,
      `description.ilike.%${kw}%`,
      `tags.cs.{${kw}}`,
    ]);
    query = query.or(conditions.join(','));
  }
  if (options?.hideStaleHardcovers) {
    // Staleness check (no sales in >1 year) is applied client-side after
    // joining with order data in getBooks when this flag is set.
  }
  return query;
}

/**
 * Fetch all books from Supabase with full filter and sort support
 */
export async function getBooks(options?: BookQueryOptions): Promise<Book[]> {
  try {
    const sortBy = options?.sortBy || 'alphabetical';

    // Sorts that require client-side ordering use a separate path:
    //   alphabetical  – needs article stripping ("The", "A", "An")
    if (sortBy === 'best-selling') {
      return getBestSellingBooks(options);
    }
    if (sortBy === 'alphabetical') {
      return getClientSortedBooks(options);
    }

    let query = supabase
      .from('books')
      .select('*');

    query = applyFilters(query, options);

    // Apply sorting with secondary keys for deterministic ordering
    switch (sortBy) {
      case 'newest':
        query = query
          .order('publication_date', { ascending: false, nullsFirst: false })
          .order('title', { ascending: true });
        break;
      case 'author':
        query = query
          .order('author_last', { ascending: true, nullsFirst: false })
          .order('title', { ascending: true });
        break;
      case 'price-asc':
        query = query
          .order('price', { ascending: true })
          .order('title', { ascending: true });
        break;
      case 'price-desc':
        query = query
          .order('price', { ascending: false })
          .order('title', { ascending: true });
        break;
      default:
        query = query.order('title');
        break;
    }

    // Apply pagination
    if (options?.offset !== undefined && options?.limit) {
      query = query.range(options.offset, options.offset + options.limit - 1);
    } else if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching books from Supabase:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    let books = data.map(mapSupabaseBookToBook);

    // Hide withdrawn / unavailable books
    books = books.filter(b => b.status !== 'Unavailable');

    // Hide limited preorders whose release date has passed (book already released)
    books = filterExpiredLimitedPreorders(books);

    // Filter out stale hardcovers client-side when flag is set
    if (options?.hideStaleHardcovers) {
      books = await filterStaleHardcovers(books);
    }

    return books;
  } catch (error) {
    console.error('Error fetching books:', error);
    return [];
  }
}

/**
 * Fetch books with client-side sorting and pagination.
 * Used for alphabetical sort which needs article stripping ("The", "A", "An")
 * so page boundaries are correct.
 */
async function getClientSortedBooks(options?: BookQueryOptions): Promise<Book[]> {
  try {
    let query = supabase.from('books').select('*');
    query = applyFilters(query, options);
    query = query.order('title'); // fallback DB order

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching books for client sort:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    let books = data.map(mapSupabaseBookToBook);

    books = books.filter(b => b.status !== 'Unavailable');
    books = filterExpiredLimitedPreorders(books);

    // Alphabetical with article stripping
    books.sort((a, b) => sortKeyForTitle(a.title).localeCompare(sortKeyForTitle(b.title)));

    if (options?.hideStaleHardcovers) {
      books = await filterStaleHardcovers(books);
    }

    // Apply pagination client-side
    const offset = options?.offset || 0;
    const limit = options?.limit || books.length;
    return books.slice(offset, offset + limit);
  } catch (error) {
    console.error('Error fetching client-sorted books:', error);
    return [];
  }
}

/** Max quantity per line item before we consider it a bulk order (excluded). */
const BULK_ORDER_THRESHOLD = 20;

/** Map bestseller period to number of days. */
function periodToDays(period?: BestsellerPeriod): number {
  switch (period) {
    case 'month': return 30;
    case 'quarter': return 90;
    case 'year': return 365;
    default: return 90;
  }
}

/** ISO date string for N days ago, used to scope "recent" bestseller queries. */
function recentCutoff(days: number = 90): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * Compute sales totals from transaction_items (book_id + quantity).
 * Only counts transactions created within the recent window.
 * Excludes bulk orders (quantity > 20 per line item).
 * Returns a map of book_id -> total units sold, or null on failure.
 */
async function getSalesFromTransactions(days: number): Promise<Record<string, number> | null> {
  try {
    const cutoff = recentCutoff(days);
    const { data, error } = await supabase
      .from('transaction_items')
      .select('book_id, quantity, transactions!inner(created_at)')
      .gte('transactions.created_at', cutoff)
      .lte('quantity', BULK_ORDER_THRESHOLD);

    if (error || !data || data.length === 0) return null;

    const salesByBook: Record<string, number> = {};
    for (const item of data) {
      if (item.book_id) {
        salesByBook[item.book_id] = (salesByBook[item.book_id] || 0) + (item.quantity || 1);
      }
    }
    return Object.keys(salesByBook).length > 0 ? salesByBook : null;
  } catch {
    return null;
  }
}

/**
 * Compute sales totals from order_items (isbn + quantity) as a fallback.
 * Only counts orders created within the recent window.
 * Excludes bulk orders (quantity > 20 per line item).
 * Returns a map of isbn -> total units sold, or null on failure.
 */
async function getSalesFromOrders(days: number): Promise<Record<string, number> | null> {
  try {
    const cutoff = recentCutoff(days);
    const { data, error } = await supabase
      .from('order_items')
      .select('isbn, quantity, orders!inner(created_at)')
      .gte('orders.created_at', cutoff)
      .lte('quantity', BULK_ORDER_THRESHOLD);

    if (error || !data || data.length === 0) return null;

    const salesByIsbn: Record<string, number> = {};
    for (const item of data) {
      if (item.isbn) {
        salesByIsbn[item.isbn] = (salesByIsbn[item.isbn] || 0) + (item.quantity || 1);
      }
    }
    return Object.keys(salesByIsbn).length > 0 ? salesByIsbn : null;
  } catch {
    return null;
  }
}

/**
 * Apply the bestseller category filter client-side.
 * Maps user-facing categories to the book's category/genre fields.
 */
function applyBestsellerCategoryFilter(books: Book[], bsCat?: BestsellerCategory): Book[] {
  if (!bsCat || bsCat === 'all') return books;
  switch (bsCat) {
    case 'fiction':       return books.filter(b => b.category === 'Fiction');
    case 'nonfiction':    return books.filter(b => b.category === 'Nonfiction');
    case 'ya':            return books.filter(b => b.category === 'YA');
    case 'children':      return books.filter(b => b.category === 'Kids');
    case 'picture-books': return books.filter(b => b.category === 'Kids' && b.genre === 'Picture Books');
    default: return books;
  }
}

/**
 * Fetch best-selling books by computing sales from transaction data.
 *
 * Supports `bestsellerPeriod` (month/quarter/year) and `bestsellerCategory`
 * (fiction/nonfiction/ya/children/picture-books) for the sectioned UI.
 *
 * Priority:
 *   1. transaction_items (POS-style, keyed by book_id)
 *   2. order_items (website orders, keyed by isbn)
 *   3. books.total_sold column (static counter from POS sync)
 *   4. Alphabetical fallback
 */
async function getBestSellingBooks(options?: BookQueryOptions): Promise<Book[]> {
  try {
    const days = periodToDays(options?.bestsellerPeriod);

    // Fetch all filtered books first (needed for any ranking approach)
    let query = supabase.from('books').select('*');
    query = applyFilters(query, options);
    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return getClientSortedBooks(options);
    }

    let books = data.map(mapSupabaseBookToBook);
    books = books.filter(b => b.status !== 'Unavailable');
    books = filterExpiredLimitedPreorders(books);

    // Apply bestseller category filter
    books = applyBestsellerCategoryFilter(books, options?.bestsellerCategory);

    // Try ranking from transaction_items (book_id)
    const txSales = await getSalesFromTransactions(days);
    if (txSales) {
      books.sort((a, b) => {
        const diff = (txSales[b.id] || 0) - (txSales[a.id] || 0);
        return diff !== 0 ? diff : sortKeyForTitle(a.title).localeCompare(sortKeyForTitle(b.title));
      });
    } else {
      // Try ranking from order_items (isbn)
      const orderSales = await getSalesFromOrders(days);
      if (orderSales) {
        books.sort((a, b) => {
          const diff = (orderSales[b.isbn || ''] || 0) - (orderSales[a.isbn || ''] || 0);
          return diff !== 0 ? diff : sortKeyForTitle(a.title).localeCompare(sortKeyForTitle(b.title));
        });
      } else {
        // Fall back to total_sold column (may be all zeros)
        const rawById = new Map(data.map((d: SupabaseBook) => [d.id, d.total_sold || 0]));
        const hasAnySales = [...rawById.values()].some(v => v > 0);
        if (hasAnySales) {
          books.sort((a, b) => {
            const diff = (rawById.get(b.id) || 0) - (rawById.get(a.id) || 0);
            return diff !== 0 ? diff : sortKeyForTitle(a.title).localeCompare(sortKeyForTitle(b.title));
          });
        } else {
          // No sales data anywhere — alphabetical
          books.sort((a, b) => sortKeyForTitle(a.title).localeCompare(sortKeyForTitle(b.title)));
        }
      }
    }

    if (options?.hideStaleHardcovers) {
      books = await filterStaleHardcovers(books);
    }

    // Apply pagination client-side
    const offset = options?.offset || 0;
    const limit = options?.limit || books.length;
    return books.slice(offset, offset + limit);
  } catch (error) {
    console.error('Error fetching best-selling books:', error);
    return getClientSortedBooks(options);
  }
}

/**
 * Hide limited-preorder books whose release date has passed.
 * After release, the special edition listing (separate ISBN) should no longer appear.
 */
function filterExpiredLimitedPreorders(books: Book[]): Book[] {
  const now = new Date();
  return books.filter(book => {
    if (!book.isLimitedPreorder || !book.releaseDate) return true;
    // Only hide if both the cutoff AND the release date have passed
    if (book.status === 'Preorder Closed' && new Date(book.releaseDate) <= now) {
      return false;
    }
    return true;
  });
}

/**
 * Filter out stale hardcovers: hardcover books with zero stock that haven't
 * sold in over a year (likely transitioned to paperback).
 */
async function filterStaleHardcovers(books: Book[]): Promise<Book[]> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAgoStr = oneYearAgo.toISOString();

  // Find hardcovers with zero stock
  const zeroStockHardcovers = books.filter(
    b => b.type === 'Hardcover' && b.status === 'Available to Order'
  );

  if (zeroStockHardcovers.length === 0) return books;

  // Check last sale date for these books
  const isbns = zeroStockHardcovers
    .map(b => b.isbn)
    .filter((isbn): isbn is string => !!isbn);

  const staleIds = new Set<string>();

  if (isbns.length > 0) {
    // Get the most recent order containing each ISBN
    const { data: recentSales } = await supabase
      .from('order_items')
      .select('isbn, order_id, orders!inner(created_at)')
      .in('isbn', isbns);

    // Find the most recent sale date per ISBN
    const lastSaleByIsbn: Record<string, string> = {};
    if (recentSales) {
      for (const sale of recentSales) {
        const saleDate = (sale as any).orders?.created_at;
        if (saleDate) {
          if (!lastSaleByIsbn[sale.isbn] || saleDate > lastSaleByIsbn[sale.isbn]) {
            lastSaleByIsbn[sale.isbn] = saleDate;
          }
        }
      }
    }

    for (const book of zeroStockHardcovers) {
      const lastSale = book.isbn ? lastSaleByIsbn[book.isbn] : undefined;
      // Stale if never sold or last sale was over a year ago
      if (!lastSale || lastSale < oneYearAgoStr) {
        staleIds.add(book.id);
      }
    }
  } else {
    // No ISBNs — mark all zero-stock hardcovers as stale
    for (const book of zeroStockHardcovers) {
      staleIds.add(book.id);
    }
  }

  return books.filter(b => !staleIds.has(b.id));
}

/**
 * Get total count of books with filters
 */
export async function getBooksCount(options?: BookQueryOptions): Promise<number> {
  try {
    let query = supabase
      .from('books')
      .select('*', { count: 'exact', head: true });

    query = applyFilters(query, options);

    const { count, error } = await query;

    if (error) {
      console.error('Error fetching book count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error fetching book count:', error);
    return 0;
  }
}

/**
 * Fetch a single book by ID
 */
export async function getBookById(id: string): Promise<Book | null> {
  try {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return mapSupabaseBookToBook(data);
  } catch (error) {
    console.error('Error fetching book by ID:', error);
    return null;
  }
}

/**
 * Fetch a single book by ISBN
 */
export async function getBookByIsbn(isbn: string): Promise<Book | null> {
  try {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('isbn', isbn)
      .single();

    if (error || !data) {
      return null;
    }

    return mapSupabaseBookToBook(data);
  } catch (error) {
    console.error('Error fetching book by ISBN:', error);
    return null;
  }
}

/**
 * Fetch staff picks
 */
export async function getStaffPicks(limit: number = 10): Promise<Book[]> {
  return getBooks({ staffPicksOnly: true, limit });
}

/**
 * Check if a book is in stock
 */
export async function checkBookAvailability(id: string): Promise<{
  available: boolean;
  inStock: number;
  reserved: number;
}> {
  try {
    const { data, error } = await supabase
      .from('books')
      .select('inventory_count, reserved_count')
      .eq('id', id)
      .single();

    if (error || !data) {
      // Assume available for demo
      return { available: true, inStock: 10, reserved: 0 };
    }

    const available = (data.inventory_count - data.reserved_count) > 0;
    return {
      available,
      inStock: data.inventory_count,
      reserved: data.reserved_count,
    };
  } catch (error) {
    return { available: true, inStock: 10, reserved: 0 };
  }
}

/**
 * Fetch bestselling books sorted by total_sold
 */
export async function getBestsellers(limit: number = 10): Promise<Book[]> {
  return getBooks({ sortBy: 'best-selling', limit });
}

/**
 * Search books by title or author
 */
export async function searchBooks(query: string, limit?: number): Promise<Book[]> {
  if (!query.trim()) {
    return getBooks({ limit });
  }

  return getBooks({ search: query, limit });
}
