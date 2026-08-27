import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import {
  reserveInventory,
  releaseInventory,
  confirmPurchase,
  growReservation,
  releaseReservationQuantity,
} from '@/lib/inventory';
import { toast } from 'sonner';

export interface CartItem {
  id: string;
  isbn?: string;
  title: string;
  author: string;
  price: number;
  quantity: number;
  cover: string;
  type: 'Hardcover' | 'Paperback' | 'Audiobook' | 'Gift Card';
  digital?: boolean; // Digital gift cards need no shipping
  bookshopUrl?: string; // For Bookshop.org integration
  reservationId?: string; // For inventory reservation tracking
  deliveryOption?: 'pickup' | 'ship'; // Track delivery preference
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  isLoading: boolean;
  preferredDelivery: 'pickup' | 'ship' | null;

  // Cart operations
  addItem: (item: Omit<CartItem, 'quantity' | 'reservationId'>, quantity?: number, deliveryOption?: 'pickup' | 'ship') => Promise<boolean>;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  confirmCartPurchase: () => Promise<void>;
  setPreferredDelivery: (option: 'pickup' | 'ship') => void;

  // Bookshop.org integration
  getBookshopCartUrl: () => string;
}

const AFFILIATE_ID = 'camarillobookworm';
const TAX_RATE = 0.0825; // California sales tax
export const SHIPPING_THRESHOLD = 50; // Free shipping over $50
export const STANDARD_SHIPPING = 5.00;

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'bookworm_cart';
const DELIVERY_STORAGE_KEY = 'bookworm_delivery';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [preferredDelivery, setPreferredDeliveryState] = useState<'pickup' | 'ship' | null>(null);
  const { user } = useAuth();

  // Calculate totals - shipping is FREE for pickup
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // Gift card purchases are not taxable in California (tax applies when redeemed)
  const taxableSubtotal = items
    .filter(item => !item.id.startsWith('gc-'))
    .reduce((sum, item) => sum + item.price * item.quantity, 0);
  const isPickup = preferredDelivery === 'pickup';
  // Digital-only carts (e-gift cards) never need shipping
  const needsShipping = items.some(item => !item.digital);
  const shipping = isPickup || !needsShipping ? 0 : (subtotal >= SHIPPING_THRESHOLD ? 0 : items.length > 0 ? STANDARD_SHIPPING : 0);
  const tax = Math.round(taxableSubtotal * TAX_RATE * 100) / 100;
  const total = subtotal + shipping + tax;
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  // Load cart and delivery preference from localStorage on mount
  useEffect(() => {
    const loadCart = () => {
      try {
        const savedCart = localStorage.getItem(CART_STORAGE_KEY);
        if (savedCart) {
          const parsed = JSON.parse(savedCart);
          setItems(parsed);
        }
        const savedDelivery = localStorage.getItem(DELIVERY_STORAGE_KEY);
        if (savedDelivery) {
          setPreferredDeliveryState(savedDelivery as 'pickup' | 'ship');
        }
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCart();
  }, []);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, isLoading]);

  // Sync cart with Supabase when user logs in (optional feature for cross-device sync)
  useEffect(() => {
    const syncCartWithServer = async () => {
      if (user && items.length > 0) {
        // You could implement server-side cart persistence here
        // For now, we'll just use localStorage
      }
    };

    syncCartWithServer();
  }, [user, items]);

  // Set preferred delivery option
  const setPreferredDelivery = useCallback((option: 'pickup' | 'ship') => {
    setPreferredDeliveryState(option);
    localStorage.setItem(DELIVERY_STORAGE_KEY, option);
  }, []);

  // Add item to cart with inventory reservation
  const addItem = useCallback(async (item: Omit<CartItem, 'quantity' | 'reservationId'>, quantity: number = 1, deliveryOption?: 'pickup' | 'ship'): Promise<boolean> => {
    // Set delivery preference if provided
    if (deliveryOption) {
      setPreferredDelivery(deliveryOption);
    }

    // Skip inventory check for gift cards and non-book items
    const isGiftCard = item.id.startsWith('gc-');

    if (!isGiftCard) {
      const existing = items.find(i => i.id === item.id);

      if (existing?.reservationId) {
        // Grow the existing reservation instead of orphaning a second one
        const grown = await growReservation(existing.reservationId, quantity);
        if (!grown.success) {
          toast.error('Unable to add to cart', {
            description: grown.error || 'This item may be reserved by another shopper.',
          });
          return false;
        }
        setItems(currentItems =>
          currentItems.map(i =>
            i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i
          )
        );
        return true;
      }

      // New item (or existing without a server reservation): reserve fresh
      const reservation = await reserveInventory(item.id, quantity);

      if (!reservation.success) {
        toast.error('Unable to add to cart', {
          description: reservation.error || 'This item may be reserved by another shopper.',
        });
        return false;
      }

      setItems(currentItems => {
        const existingIndex = currentItems.findIndex(i => i.id === item.id);
        if (existingIndex >= 0) {
          const updated = [...currentItems];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + quantity,
            reservationId: reservation.reservation?.id,
          };
          return updated;
        }
        return [...currentItems, {
          ...item,
          quantity,
          reservationId: reservation.reservation?.id,
          deliveryOption,
        }];
      });
    } else {
      // Gift cards don't need inventory reservation
      setItems(currentItems => [...currentItems, { ...item, quantity }]);
    }

    return true;
  }, [items, setPreferredDelivery]);

  // Remove item from cart and release inventory
  const removeItem = useCallback((id: string) => {
    setItems(currentItems => {
      const item = currentItems.find(i => i.id === id);
      if (item && !item.id.startsWith('gc-')) {
        // Release the inventory reservation (fire-and-forget but log errors)
        releaseInventory(item.id, item.quantity, item.reservationId)
          .catch(err => console.error('Failed to release inventory for', id, err));
      }
      return currentItems.filter(i => i.id !== id);
    });
  }, []);

  // Update item quantity, reserving or releasing the difference
  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(id);
      return;
    }

    const item = items.find(i => i.id === id);
    if (!item) return;
    const delta = quantity - item.quantity;
    if (delta === 0) return;

    const applyQuantity = () =>
      setItems(currentItems =>
        currentItems.map(i => (i.id === id ? { ...i, quantity } : i))
      );

    // Gift cards and items without server reservations: no stock to manage
    if (item.id.startsWith('gc-') || !item.reservationId) {
      applyQuantity();
      return;
    }

    if (delta > 0) {
      // Increasing: reserve the extra copies first, keep quantity on failure
      growReservation(item.reservationId, delta).then(result => {
        if (result.success) {
          applyQuantity();
        } else {
          toast.error('Not enough copies available', {
            description: result.error || 'The remaining copies are reserved by other shoppers.',
          });
        }
      });
    } else {
      // Decreasing: release the difference (fire-and-forget)
      releaseReservationQuantity(item.reservationId, -delta)
        .catch(err => console.error('Failed to release reservation quantity:', err));
      applyQuantity();
    }
  }, [items, removeItem]);

  // Clear entire cart and release all reservations
  const clearCart = useCallback(() => {
    // Release all inventory reservations (fire-and-forget but log errors)
    Promise.allSettled(
      items
        .filter(item => !item.id.startsWith('gc-') && item.reservationId)
        .map(item => releaseInventory(item.id, item.quantity, item.reservationId))
    ).catch(err => console.error('Failed to release some inventory reservations:', err));

    setItems([]);
    setPreferredDeliveryState(null);
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(DELIVERY_STORAGE_KEY);
  }, [items]);

  // Confirm purchase - convert all reservations to actual sales.
  // Clears the cart WITHOUT releasing reservations (they were consumed
  // by confirmPurchase); calling clearCart() here would double-decrement.
  const confirmCartPurchase = useCallback(async () => {
    for (const item of items) {
      if (!item.id.startsWith('gc-')) {
        await confirmPurchase(item.id, item.quantity, item.reservationId);
      }
    }
    setItems([]);
    setPreferredDeliveryState(null);
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(DELIVERY_STORAGE_KEY);
  }, [items]);

  // Generate Bookshop.org affiliate cart URL
  // Bookshop allows adding multiple books via ISBN
  const getBookshopCartUrl = useCallback(() => {
    const baseUrl = `https://bookshop.org/shop/${AFFILIATE_ID}`;

    if (items.length === 0) return baseUrl;

    // If we have ISBNs, we can create a cart URL
    const isbns = items.filter(item => item.isbn).map(item => item.isbn);
    if (isbns.length > 0) {
      // Bookshop.org affiliate link format
      return `${baseUrl}?items=${isbns.join(',')}`;
    }

    return baseUrl;
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        tax,
        shipping,
        total,
        isLoading,
        preferredDelivery,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        confirmCartPurchase,
        setPreferredDelivery,
        getBookshopCartUrl,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

// Bookshop.org integration utilities
export const BOOKSHOP_AFFILIATE_ID = AFFILIATE_ID;

export const getBookshopAffiliateUrl = (isbn?: string): string => {
  if (isbn) {
    return `https://bookshop.org/a/${AFFILIATE_ID}/${isbn}`;
  }
  return `https://bookshop.org/shop/${AFFILIATE_ID}`;
};

export const getBookshopWidgetUrl = (): string => {
  return `https://bookshop.org/lists/widgets/${AFFILIATE_ID}`;
};
