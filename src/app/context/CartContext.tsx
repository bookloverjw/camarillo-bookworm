import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

export interface CartItem {
  id: string;
  isbn?: string;
  title: string;
  author: string;
  price: number;
  quantity: number;
  cover: string;
  type: 'Hardcover' | 'Paperback' | 'Audiobook';
  bookshopUrl?: string; // For Bookshop.org integration
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  isLoading: boolean;

  // Cart operations
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;

  // Bookshop.org integration
  getBookshopCartUrl: () => string;
}

const AFFILIATE_ID = '106226';
const TAX_RATE = 0.0825; // California sales tax
const SHIPPING_THRESHOLD = 50; // Free shipping over $50
const STANDARD_SHIPPING = 5.00;

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'bookworm_cart';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal >= SHIPPING_THRESHOLD ? 0 : items.length > 0 ? STANDARD_SHIPPING : 0;
  const tax = subtotal * TAX_RATE;
  const total = subtotal + shipping + tax;
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  // Load cart from localStorage on mount
  useEffect(() => {
    const loadCart = () => {
      try {
        const savedCart = localStorage.getItem(CART_STORAGE_KEY);
        if (savedCart) {
          const parsed = JSON.parse(savedCart);
          setItems(parsed);
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

  // Add item to cart
  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
    setItems(currentItems => {
      const existingIndex = currentItems.findIndex(i => i.id === item.id);

      if (existingIndex >= 0) {
        // Update quantity of existing item
        const updated = [...currentItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      } else {
        // Add new item
        return [...currentItems, { ...item, quantity }];
      }
    });
  }, []);

  // Remove item from cart
  const removeItem = useCallback((id: string) => {
    setItems(currentItems => currentItems.filter(item => item.id !== id));
  }, []);

  // Update item quantity
  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(id);
      return;
    }

    setItems(currentItems =>
      currentItems.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    );
  }, [removeItem]);

  // Clear entire cart
  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

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
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
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
