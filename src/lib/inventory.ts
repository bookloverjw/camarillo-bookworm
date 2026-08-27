// Inventory management for Camarillo Bookworm
// Handles reservation of books when added to cart to prevent overselling.
//
// All writes go through atomic SECURITY DEFINER functions defined in
// supabase/rls-lockdown.sql (reserve_book, grow_reservation,
// release_reservation, release_reservation_quantity, confirm_reservation).
// The browser has no direct write access to books or inventory_reservations.

import { supabase } from './supabase';

export interface InventoryReservation {
  id: string;
  bookId: string;
  quantity: number;
  sessionId: string;
  expiresAt: Date;
  createdAt: Date;
}

// Generate a session ID for anonymous users.
// localStorage (not sessionStorage) so it matches the cart's persistence:
// a cart that survives a browser restart keeps reservations addressable.
export function getSessionId(): string {
  let sessionId = localStorage.getItem('bookworm_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('bookworm_session_id', sessionId);
  }
  return sessionId;
}

// PGRST202 = function not found: the rls-lockdown.sql migration hasn't been
// applied yet. Degrade to allowing the action (old behavior) instead of
// bricking the store, but say so in the console.
function isMigrationMissing(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST202';
}

function localReservation(bookId: string, quantity: number): InventoryReservation {
  return {
    id: `res_${Date.now()}`,
    bookId,
    quantity,
    sessionId: getSessionId(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    createdAt: new Date(),
  };
}

// Reserve inventory when adding to cart
export async function reserveInventory(
  bookId: string,
  quantity: number
): Promise<{ success: boolean; error?: string; reservation?: InventoryReservation }> {
  try {
    const { data, error } = await supabase.rpc('reserve_book', {
      p_book_id: bookId,
      p_quantity: quantity,
      p_session_id: getSessionId(),
    });

    if (error) {
      if (isMigrationMissing(error)) {
        console.warn('reserve_book RPC missing - run supabase/rls-lockdown.sql. Allowing without reservation.');
        return { success: true, reservation: localReservation(bookId, quantity) };
      }
      console.error('Reservation failed:', error);
      return { success: false, error: 'Could not check availability. Please try again.' };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.error) {
      return { success: false, error: row?.error || 'This item is unavailable.' };
    }

    return {
      success: true,
      reservation: {
        id: row.reservation_id,
        bookId,
        quantity,
        sessionId: getSessionId(),
        expiresAt: new Date(row.expires_at),
        createdAt: new Date(),
      },
    };
  } catch (error) {
    console.error('Inventory reservation error:', error);
    return { success: false, error: 'Could not check availability. Please try again.' };
  }
}

// Grow an existing reservation (cart quantity increase)
export async function growReservation(
  reservationId: string,
  quantity: number
): Promise<{ success: boolean; error?: string }> {
  if (reservationId.startsWith('res_')) {
    return { success: true }; // local/demo reservation, nothing to grow
  }
  try {
    const { data, error } = await supabase.rpc('grow_reservation', {
      p_reservation_id: reservationId,
      p_quantity: quantity,
    });

    if (error) {
      if (isMigrationMissing(error)) return { success: true };
      console.error('Grow reservation failed:', error);
      return { success: false, error: 'Could not check availability. Please try again.' };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (row?.error) {
      return { success: false, error: row.error };
    }
    return { success: true };
  } catch (error) {
    console.error('Grow reservation error:', error);
    return { success: false, error: 'Could not check availability. Please try again.' };
  }
}

// Release an entire reservation (item removed from cart)
export async function releaseInventory(
  _bookId: string,
  _quantity: number,
  reservationId?: string
): Promise<{ success: boolean }> {
  if (!reservationId || reservationId.startsWith('res_')) {
    return { success: true };
  }
  try {
    const { error } = await supabase.rpc('release_reservation', {
      p_reservation_id: reservationId,
    });
    if (error && !isMigrationMissing(error)) {
      console.error('Release reservation failed:', error);
    }
  } catch (error) {
    console.error('Release reservation error:', error);
  }
  return { success: true };
}

// Release part of a reservation (cart quantity decrease)
export async function releaseReservationQuantity(
  reservationId: string,
  quantity: number
): Promise<{ success: boolean }> {
  if (reservationId.startsWith('res_')) {
    return { success: true };
  }
  try {
    const { error } = await supabase.rpc('release_reservation_quantity', {
      p_reservation_id: reservationId,
      p_quantity: quantity,
    });
    if (error && !isMigrationMissing(error)) {
      console.error('Release quantity failed:', error);
    }
  } catch (error) {
    console.error('Release quantity error:', error);
  }
  return { success: true };
}

// Confirm purchase - consume the reservation and decrement stock atomically.
// Safe to call with a missing/local reservation id: stock is still
// decremented, and reserved_count is only reduced by what the reservation
// actually held (so it can never double-decrement).
export async function confirmPurchase(
  bookId: string,
  quantity: number,
  reservationId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const serverReservationId =
      reservationId && !reservationId.startsWith('res_') ? reservationId : '';
    const { error } = await supabase.rpc('confirm_reservation', {
      p_reservation_id: serverReservationId,
      p_book_id: bookId,
      p_quantity: quantity,
    });
    if (error && !isMigrationMissing(error)) {
      console.error('Confirm purchase failed:', error);
      return { success: false, error: 'Inventory update failed' };
    }
    return { success: true };
  } catch (error) {
    console.error('Confirm purchase error:', error);
    return { success: false, error: 'Inventory update failed' };
  }
}

// Check if a book is available (read-only; the reserve_book RPC is the
// authoritative gate - this is just for UI display).
export async function checkAvailability(
  bookId: string,
  requestedQuantity: number = 1
): Promise<{ available: boolean; inStock: number; reserved: number; message?: string }> {
  try {
    const { data: book, error } = await supabase
      .from('books')
      .select('inventory_count, reserved_count')
      .eq('id', bookId)
      .single();

    if (error || !book) {
      // Display-only fallback; reserve_book still enforces the real limit
      return { available: true, inStock: 0, reserved: 0 };
    }

    const inStock = book.inventory_count || 0;
    const reserved = book.reserved_count || 0;
    const actualAvailable = inStock - reserved;

    if (actualAvailable < requestedQuantity) {
      return {
        available: false,
        inStock,
        reserved,
        message:
          actualAvailable <= 0
            ? 'This book is currently reserved by other shoppers. Check back soon!'
            : `Only ${actualAvailable} available (${reserved} reserved by other shoppers)`,
      };
    }

    return { available: true, inStock, reserved };
  } catch (error) {
    console.error('Check availability error:', error);
    return { available: true, inStock: 0, reserved: 0 };
  }
}

// Clean up expired reservations (also scheduled server-side via pg_cron;
// see supabase/rls-lockdown.sql)
export async function cleanupExpiredReservations(): Promise<void> {
  try {
    const { error } = await supabase.rpc('cleanup_expired_reservations');
    if (error && !isMigrationMissing(error)) {
      console.error('Cleanup expired reservations error:', error);
    }
  } catch (error) {
    console.error('Cleanup expired reservations error:', error);
  }
}
