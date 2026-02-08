/**
 * Book Service
 * Fetches books from Supabase (synced from BookMagic POS)
 */

import { supabase } from './supabase';
import { type Book } from '@/app/utils/data';
import { splitTitle } from './titleUtils';

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
    status: mapStatus(sb.status, sb.inventory_count),
    releaseDate: sb.publication_date || undefined,
    description: sb.description || '',
    isStaffPick: sb.is_staff_pick,
    staffReviewer: sb.staff_reviewer || undefined,
    staffQuote: sb.staff_quote || undefined,
  };
}

/**
 * Map database status to website status
 */
function mapStatus(status: string | null, inventoryCount: number): Book['status'] {
  if (status === 'Preorder' || status === 'preorder') return 'Preorder';
  if (inventoryCount <= 0) return 'Ships in X days';
  if (inventoryCount <= 3) return 'Low Stock';
  return 'In Stock';
}

/**
 * Fetch all books from Supabase with pagination support
 */
export async function getBooks(options?: {
  category?: string;
  inStockOnly?: boolean;
  staffPicksOnly?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<Book[]> {
  try {
    let query = supabase
      .from('books')
      .select('*');

    // Apply filters
    if (options?.category && options.category !== 'All') {
      query = query.eq('category', options.category);
    }
    if (options?.inStockOnly) {
      query = query.gt('inventory_count', 0);
    }
    if (options?.staffPicksOnly) {
      query = query.eq('is_staff_pick', true);
    }
    if (options?.search) {
      const searchTerm = `%${options.search}%`;
      query = query.or(`title.ilike.${searchTerm},author.ilike.${searchTerm}`);
    }

    // Order by title
    query = query.order('title');

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

    // Return empty array if no books
    if (!data || data.length === 0) {
      return [];
    }

    // Map Supabase books to website format
    return data.map(mapSupabaseBookToBook);
  } catch (error) {
    console.error('Error fetching books:', error);
    return [];
  }
}

/**
 * Get total count of books with filters
 */
export async function getBooksCount(options?: {
  category?: string;
  inStockOnly?: boolean;
  staffPicksOnly?: boolean;
  search?: string;
}): Promise<number> {
  try {
    let query = supabase
      .from('books')
      .select('*', { count: 'exact', head: true });

    // Apply same filters as getBooks
    if (options?.category && options.category !== 'All') {
      query = query.eq('category', options.category);
    }
    if (options?.inStockOnly) {
      query = query.gt('inventory_count', 0);
    }
    if (options?.staffPicksOnly) {
      query = query.eq('is_staff_pick', true);
    }
    if (options?.search) {
      const searchTerm = `%${options.search}%`;
      query = query.or(`title.ilike.${searchTerm},author.ilike.${searchTerm}`);
    }

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
