/**
 * Staff Service
 * Fetches staff members and their picks from Supabase
 */

import { supabase } from './supabase';
import type { StaffMember as SupabaseStaffMember, StaffPick as SupabaseStaffPick } from './supabase';
import type { StaffMember, Book } from '@/app/utils/data';
import { getBookByIsbn } from './bookService';

export interface StaffMemberWithPicks extends StaffMember {
  picks: {
    book: Book;
    quote?: string;
  }[];
}

/**
 * Map Supabase staff member to the app's StaffMember format
 */
function mapStaffMember(sb: SupabaseStaffMember): StaffMember {
  return {
    id: sb.id,
    name: sb.name,
    role: sb.role,
    photo: sb.photo_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=400',
    bio: sb.bio || '',
    topPicks: [], // filled in separately
  };
}

/**
 * Fetch all active staff members ordered by display_order
 */
export async function getStaffMembers(): Promise<StaffMember[]> {
  try {
    const { data, error } = await supabase
      .from('staff_members')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map(mapStaffMember);
  } catch (error) {
    console.error('Error fetching staff members:', error);
    return [];
  }
}

/**
 * Fetch staff members with their picks and resolved book data.
 * Each pick's book is fetched from the books table by ISBN.
 */
export async function getStaffMembersWithPicks(): Promise<StaffMemberWithPicks[]> {
  try {
    // Fetch staff members
    const { data: staffData, error: staffError } = await supabase
      .from('staff_members')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (staffError || !staffData || staffData.length === 0) {
      return [];
    }

    // Fetch all staff picks
    const { data: picksData, error: picksError } = await supabase
      .from('staff_picks')
      .select('*')
      .order('display_order', { ascending: true });

    if (picksError) {
      console.error('Error fetching staff picks:', picksError);
    }

    const picks = (picksData || []) as SupabaseStaffPick[];

    // Group picks by staff member
    const picksByStaff = new Map<string, SupabaseStaffPick[]>();
    for (const pick of picks) {
      const existing = picksByStaff.get(pick.staff_member_id) || [];
      existing.push(pick);
      picksByStaff.set(pick.staff_member_id, existing);
    }

    // Resolve books for each pick
    const results: StaffMemberWithPicks[] = [];
    for (const sb of staffData) {
      const member = mapStaffMember(sb);
      const memberPicks = picksByStaff.get(sb.id) || [];

      const resolvedPicks: StaffMemberWithPicks['picks'] = [];
      for (const pick of memberPicks) {
        const book = await getBookByIsbn(pick.isbn);
        if (book) {
          member.topPicks.push(book.id);
          resolvedPicks.push({ book, quote: pick.quote || undefined });
        } else {
          // Use pick data directly if book not in books table
          resolvedPicks.push({
            book: {
              id: pick.id,
              isbn: pick.isbn,
              title: pick.title,
              author: pick.author,
              price: 0,
              cover: pick.cover_url || 'https://images.unsplash.com/photo-1538981457319-5e459479f9d0?auto=format&fit=crop&q=80&w=600',
              category: 'Fiction',
              genre: 'Literary',
              type: 'Paperback',
              status: 'Available to Order',
              description: '',
            },
            quote: pick.quote || undefined,
          });
          member.topPicks.push(pick.id);
        }
      }

      results.push({ ...member, picks: resolvedPicks });
    }

    return results;
  } catch (error) {
    console.error('Error fetching staff with picks:', error);
    return [];
  }
}
