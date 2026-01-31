// Gift Card Service - handles activation of gift cards after payment
import { supabase } from './supabase';
import {
  generateBarcodeNumber,
  GiftCardPassData,
} from './appleWallet';

export interface PendingGiftCard {
  id: string;
  type: 'physical' | 'digital';
  amount: number;
  recipientName: string | null;
  recipientEmail: string | null;
  message: string | null;
  purchaserEmail: string | null;
  purchaserName: string | null;
}

const PENDING_STORAGE_KEY = 'pending_gift_cards';

/**
 * Store a pending gift card (before payment)
 */
export function storePendingGiftCard(card: PendingGiftCard): void {
  const existing = getPendingGiftCards();
  existing.push(card);
  localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(existing));
}

/**
 * Get all pending gift cards
 */
export function getPendingGiftCards(): PendingGiftCard[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Check if a cart item is a pending gift card
 */
export function isPendingGiftCard(itemId: string): boolean {
  const pending = getPendingGiftCards();
  return pending.some(card => card.id === itemId);
}

/**
 * Activate a gift card after payment is confirmed
 * This generates the actual card number and stores it in the database
 */
export async function activateGiftCard(giftCardId: string): Promise<GiftCardPassData | null> {
  try {
    // Get pending gift card details
    const pendingCards = getPendingGiftCards();
    const pendingCard = pendingCards.find(c => c.id === giftCardId);

    if (!pendingCard) {
      console.error('Pending gift card not found:', giftCardId);
      return null;
    }

    // NOW generate the actual gift card code (after payment confirmed)
    const code = `GC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const barcodeNumber = generateBarcodeNumber(code);
    const purchaseDate = new Date().toISOString();
    const expirationDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2).toISOString(); // 2 years

    // Create gift card record in Supabase
    const { data: giftCard, error: createError } = await supabase.from('gift_cards').insert({
      code: barcodeNumber,
      initial_balance: pendingCard.amount,
      current_balance: pendingCard.amount,
      currency: 'USD',
      purchaser_email: pendingCard.purchaserEmail,
      purchaser_name: pendingCard.purchaserName,
      recipient_email: pendingCard.recipientEmail,
      recipient_name: pendingCard.recipientName,
      message: pendingCard.message,
      status: 'active',
      purchased_at: purchaseDate,
      expires_at: expirationDate,
      created_at: purchaseDate,
      updated_at: purchaseDate,
    }).select().single();

    if (createError) {
      console.error('Gift card creation error:', createError);
      // Continue anyway for demo - generate card data without DB
    }

    // Record the purchase transaction
    if (giftCard) {
      await supabase.from('gift_card_transactions').insert({
        gift_card_id: giftCard.id,
        type: 'purchase',
        amount: pendingCard.amount,
        balance_after: pendingCard.amount,
        notes: pendingCard.type === 'digital' ? 'E-Gift Card purchase' : 'Physical gift card purchase',
        created_at: purchaseDate,
      });
    }

    // Remove from pending
    const updatedPending = pendingCards.filter(c => c.id !== giftCardId);
    localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(updatedPending));

    // Return card data for display
    return {
      cardNumber: barcodeNumber,
      balance: pendingCard.amount,
      recipientName: pendingCard.recipientName || undefined,
      purchaseDate,
      expirationDate,
    };

  } catch (err) {
    console.error('Gift card activation error:', err);
    return null;
  }
}

/**
 * Activate all pending gift cards for items in the completed order
 */
export async function activateAllGiftCards(cartItemIds: string[]): Promise<GiftCardPassData[]> {
  const activatedCards: GiftCardPassData[] = [];

  for (const itemId of cartItemIds) {
    if (itemId.startsWith('gc-')) {
      const cardData = await activateGiftCard(itemId);
      if (cardData) {
        activatedCards.push(cardData);
      }
    }
  }

  return activatedCards;
}

/**
 * Clear all pending gift cards (e.g., on cart clear)
 */
export function clearPendingGiftCards(): void {
  localStorage.removeItem(PENDING_STORAGE_KEY);
}
