import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lildbdxabljkoynvpflu.supabase.co';
const supabaseAnonKey = 'sb_publishable_h_B4nBpI9hTOycnv4Fj6Tw_epMD62aO';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Database types based on your schema
export interface Customer {
  id: string;
  email: string;
  phone?: string;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
  email_verified: boolean;
  phone_verified: boolean;
  marketing_opt_in: boolean;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  type: 'billing' | 'shipping';
  is_default: boolean;
  first_name: string;
  last_name: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Wishlist {
  id: string;
  customer_id: string;
  name: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface WishlistItem {
  id: string;
  wishlist_id: string;
  isbn: string;
  title: string;
  author: string;
  cover_url?: string;
  price?: number;
  added_at: string;
  notes?: string;
}

export interface Order {
  id: string;
  customer_id: string;
  order_number: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  shipping_address_id?: string;
  billing_address_id?: string;
  payment_method?: string;
  payment_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  isbn: string;
  title: string;
  author: string;
  quantity: number;
  unit_price: number;
  extended_price: number;
  cover_url?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  photo_url?: string;
  bio?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface StaffPick {
  id: string;
  staff_member_id: string;
  isbn: string;
  title: string;
  author: string;
  cover_url?: string;
  quote?: string;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  event_type: 'author_reading' | 'book_club' | 'kids_story_time' | 'workshop' | 'signing' | 'other';
  location: 'in_store' | 'virtual' | 'offsite';
  start_time: string;
  end_time?: string;
  max_attendees?: number;
  registration_required: boolean;
  registration_fee?: number;
  featured_isbn?: string;
  featured_book_title?: string;
  featured_book_author?: string;
  featured_book_cover?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  customer_id?: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  guests: number;
  status: 'registered' | 'confirmed' | 'cancelled' | 'attended';
  payment_status?: 'pending' | 'paid' | 'refunded';
  payment_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  source?: string;
  subscribed_at: string;
  unsubscribed_at?: string;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  status: 'new' | 'read' | 'responded' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface GiftCard {
  id: string;
  code: string;
  initial_balance: number;
  current_balance: number;
  currency: string;
  purchaser_email?: string;
  purchaser_name?: string;
  recipient_email?: string;
  recipient_name?: string;
  message?: string;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  purchased_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface GiftCardTransaction {
  id: string;
  gift_card_id: string;
  type: 'purchase' | 'redemption' | 'refund' | 'adjustment';
  amount: number;
  balance_after: number;
  order_id?: string;
  notes?: string;
  created_at: string;
}
