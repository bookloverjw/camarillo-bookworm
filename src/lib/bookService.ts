/**
 * Book Service
 * Fetches books from Supabase (synced from BookMagic POS)
 */

import { supabase } from './supabase';
import { type Book } from '@/app/utils/data';
import { splitTitle } from './titleUtils';

export type SortOption = 'newest' | 'price-asc' | 'price-desc' | 'alphabetical' | 'author' | 'best-selling';

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
  hideStaleHardcovers?: boolean;
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
  is_limited_preorder: boolean;
  preorder_cutoff_date: string | null;
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
    author: sb.author,
    price: sb.price || 0,
    cover: sb.cover_url || 'https://images.unsplash.com/photo-1538981457319-5e459479f9d0?auto=format&fit=crop&q=80&w=600',
    category: (sb.category as Book['category']) || 'Fiction',
    genre: sb.genre || 'Literary',
    type: (sb.book_type as Book['type']) || 'Paperback',
    status: mapStatus(sb.status, sb.inventory_count, sb.is_limited_preorder, sb.preorder_cutoff_date),
    releaseDate: sb.publication_date || undefined,
    isLimitedPreorder: sb.is_limited_preorder || false,
    preorderCutoffDate: sb.preorder_cutoff_date || undefined,
    description: sb.description || '',
    isStaffPick: sb.is_staff_pick,
    staffReviewer: sb.staff_reviewer || undefined,
    staffQuote: sb.staff_quote || undefined,
  };
}

/**
 * Map database status to website status.
 * Limited preorders whose cutoff date has passed become 'Preorder Closed'.
 */
function mapStatus(
  status: string | null,
  inventoryCount: number,
  isLimitedPreorder?: boolean,
  preorderCutoffDate?: string | null,
): Book['status'] {
  if (status === 'Preorder' || status === 'preorder') {
    if (isLimitedPreorder && preorderCutoffDate) {
      const cutoff = new Date(preorderCutoffDate);
      if (new Date() > cutoff) return 'Preorder Closed';
    }
    return 'Preorder';
  }
  if (inventoryCount <= 0) return 'Ships in X days';
  if (inventoryCount <= 3) return 'Low Stock';
  return 'In Stock';
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
  if (options?.hideStaleHardcovers) {
    // Hide hardcovers with zero stock — the staleness check (no sales in >1 year)
    // is applied client-side after joining with order data, but we can at least
    // note that stale filtering happens in getBooks when this flag is set.
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
    //   best-selling  – needs order_items join
    //   alphabetical  – needs article stripping ("The", "A", "An")
    //   author        – needs article stripping on author last-name
    if (sortBy === 'best-selling') {
      return getBestSellingBooks(options);
    }
    if (sortBy === 'alphabetical' || sortBy === 'author') {
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
 * Used for sorts that need JavaScript logic (article stripping, author parsing).
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

    books = filterExpiredLimitedPreorders(books);

    // Sort client-side
    const sortBy = options?.sortBy || 'alphabetical';
    if (sortBy === 'author') {
      books.sort((a, b) => {
        const cmp = a.author.toLowerCase().localeCompare(b.author.toLowerCase());
        if (cmp !== 0) return cmp;
        return sortKeyForTitle(a.title).localeCompare(sortKeyForTitle(b.title));
      });
    } else {
      // alphabetical with article stripping
      books.sort((a, b) => sortKeyForTitle(a.title).localeCompare(sortKeyForTitle(b.title)));
    }

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

/**
 * Fetch best-selling books, ignoring bulk orders (>20 copies in a single transaction).
 * Falls back to alphabetical if no sales data is available.
 */
async function getBestSellingBooks(options?: BookQueryOptions): Promise<Book[]> {
  try {
    // Get non-bulk order item sales: sum quantity per ISBN, excluding order_items
    // where a single line item has quantity > 20 (likely bulk/institutional orders)
    const { data: salesData, error: salesError } = await supabase
      .from('order_items')
      .select('isbn, quantity');

    // Get all books with filters applied
    let query = supabase.from('books').select('*');
    query = applyFilters(query, options);
    query = query.order('title'); // fallback order

    const { data: booksData, error: booksError } = await query;

    if (booksError) {
      console.error('Error fetching books for best-selling:', booksError);
      return [];
    }

    if (!booksData || booksData.length === 0) return [];

    // Build sales count map, filtering out bulk orders (>20 per line item)
    const salesByIsbn: Record<string, number> = {};
    if (salesData && !salesError) {
      for (const item of salesData) {
        if (item.quantity <= 20) {
          salesByIsbn[item.isbn] = (salesByIsbn[item.isbn] || 0) + item.quantity;
        }
      }
    }

    let books = booksData.map(mapSupabaseBookToBook);

    // Hide limited preorders whose release date has passed
    books = filterExpiredLimitedPreorders(books);

    // Sort by total sales descending, then by title
    books.sort((a, b) => {
      const salesA = (a.isbn && salesByIsbn[a.isbn]) || 0;
      const salesB = (b.isbn && salesByIsbn[b.isbn]) || 0;
      if (salesB !== salesA) return salesB - salesA;
      return sortKeyForTitle(a.title).localeCompare(sortKeyForTitle(b.title));
    });

    // Filter out stale hardcovers if needed
    if (options?.hideStaleHardcovers) {
      books = await filterStaleHardcovers(books);
    }

    // Apply pagination client-side since we sorted client-side
    const offset = options?.offset || 0;
    const limit = options?.limit || books.length;
    return books.slice(offset, offset + limit);
  } catch (error) {
    console.error('Error fetching best-selling books:', error);
    return [];
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
    b => b.type === 'Hardcover' && b.status === 'Ships in X days'
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
    // For best-selling, we still count the same filtered set
    if (options?.sortBy === 'best-selling') {
      // Count doesn't change based on sort, just use same filters without sort
      const countOptions = { ...options, sortBy: undefined as any };
      return getBooksCount(countOptions);
    }

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
 * Search books by title or author
 */
export async function searchBooks(query: string, limit?: number): Promise<Book[]> {
  if (!query.trim()) {
    return getBooks({ limit });
  }

  return getBooks({ search: query, limit });
}
