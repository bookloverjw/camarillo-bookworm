/**
 * Book Service
 * Fetches books from Supabase with fallback to static demo data
 */

import { supabase } from './supabase';
import { BOOKS, type Book } from '@/app/utils/data';

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
  return {
    id: sb.id,
    isbn: sb.isbn,
    title: sb.title,
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
 * Fetch all books from Supabase
 * Falls back to static BOOKS array if database is empty or unavailable
 */
export async function getBooks(options?: {
  category?: string;
  inStockOnly?: boolean;
  staffPicksOnly?: boolean;
  limit?: number;
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

    // Order by title
    query = query.order('title');

    // Apply limit
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching books from Supabase:', error);
      return BOOKS; // Fallback to static data
    }

    // If no books in database, use static data
    if (!data || data.length === 0) {
      console.log('No books in database, using static demo data');
      return BOOKS;
    }

    // Map Supabase books to website format
    return data.map(mapSupabaseBookToBook);
  } catch (error) {
    console.error('Error fetching books:', error);
    return BOOKS; // Fallback to static data
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
      // Try to find in static data
      const staticBook = BOOKS.find(b => b.id === id);
      return staticBook || null;
    }

    return mapSupabaseBookToBook(data);
  } catch (error) {
    // Try to find in static data
    const staticBook = BOOKS.find(b => b.id === id);
    return staticBook || null;
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
      // Try to find in static data
      const staticBook = BOOKS.find(b => b.isbn === isbn);
      return staticBook || null;
    }

    return mapSupabaseBookToBook(data);
  } catch (error) {
    // Try to find in static data
    const staticBook = BOOKS.find(b => b.isbn === isbn);
    return staticBook || null;
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
export async function searchBooks(query: string): Promise<Book[]> {
  if (!query.trim()) {
    return getBooks();
  }

  try {
    const searchTerm = `%${query}%`;

    const { data, error } = await supabase
      .from('books')
      .select('*')
      .or(`title.ilike.${searchTerm},author.ilike.${searchTerm}`)
      .order('title');

    if (error) {
      console.error('Search error:', error);
      // Fallback to filtering static data
      return BOOKS.filter(b =>
        b.title.toLowerCase().includes(query.toLowerCase()) ||
        b.author.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (!data || data.length === 0) {
      // Search static data as fallback
      return BOOKS.filter(b =>
        b.title.toLowerCase().includes(query.toLowerCase()) ||
        b.author.toLowerCase().includes(query.toLowerCase())
      );
    }

    return data.map(mapSupabaseBookToBook);
  } catch (error) {
    // Fallback to filtering static data
    return BOOKS.filter(b =>
      b.title.toLowerCase().includes(query.toLowerCase()) ||
      b.author.toLowerCase().includes(query.toLowerCase())
    );
  }
}
