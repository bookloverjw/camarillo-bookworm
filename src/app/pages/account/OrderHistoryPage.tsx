import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Package, ChevronDown, ChevronUp, ExternalLink, RefreshCw, HelpCircle, BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router';

interface OrderItemData {
  title: string;
  quantity: number;
  unit_price: number;
}

interface OrderData {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total: number;
  delivery_option: string;
  shipping_first_name: string | null;
  shipping_last_name: string | null;
  shipping_address_1: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  tracking_number: string | null;
  order_items: OrderItemData[];
}

type TimePeriod = '6months' | '1year' | '2025' | '2024' | 'all';

const OrderItem = ({ order }: { order: OrderData }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-50 text-green-700 border-green-100';
      case 'shipped': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'confirmed':
      case 'processing': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'ready for pickup': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const displayStatus = order.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Processing';
  const items = order.order_items || [];

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm mb-4">
      <div
        className="p-6 cursor-pointer hover:bg-muted/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-primary/40">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-1">Order {order.order_number}</p>
            <p className="font-bold text-primary">{formatDate(order.created_at)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${getStatusColor(order.status)}`}>
            {displayStatus}
          </div>
          <div className="text-right min-w-[80px]">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-widest">Total</p>
            <p className="font-bold text-primary">${order.total.toFixed(2)}</p>
          </div>
          <div className="p-2 text-muted-foreground">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-6 pb-6 pt-2 border-t border-border bg-muted/10"
        >
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Items</p>
              <div className="space-y-4">
                {items.length > 0 ? items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-14 bg-white border border-border rounded overflow-hidden flex items-center justify-center text-primary/20">
                        <BookOpen size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary leading-tight">{item.title}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-primary">${(item.unit_price * item.quantity).toFixed(2)}</p>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No item details available.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-border">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  {order.delivery_option === 'pickup' ? 'Pickup' : 'Shipping Address'}
                </p>
                {order.delivery_option === 'pickup' ? (
                  <p className="text-sm text-primary leading-relaxed">In-store pickup at Camarillo Bookworm</p>
                ) : order.shipping_address_1 ? (
                  <p className="text-sm text-primary leading-relaxed">
                    {order.shipping_first_name} {order.shipping_last_name}<br />
                    {order.shipping_address_1}<br />
                    {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No address on file.</p>
                )}
              </div>
              <div className="flex flex-col justify-end space-y-3">
                {order.tracking_number && (
                  <button className="flex items-center justify-center space-x-2 w-full bg-primary text-white py-3 rounded-xl text-xs font-bold hover:bg-primary/90 transition-all">
                    <ExternalLink size={14} />
                    <span>Track Package</span>
                  </button>
                )}
                <button className="flex items-center justify-center space-x-2 w-full border border-border bg-white text-primary py-3 rounded-xl text-xs font-bold hover:bg-muted transition-all">
                  <HelpCircle size={14} />
                  <span>Need help with this order?</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export const OrderHistoryPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>('6months');

  useEffect(() => {
    if (!user?.id) { setIsLoading(false); return; }

    async function loadOrders() {
      setIsLoading(true);
      try {
        let query = supabase
          .from('orders')
          .select('id, order_number, created_at, status, total, delivery_option, shipping_first_name, shipping_last_name, shipping_address_1, shipping_city, shipping_state, shipping_postal_code, tracking_number, order_items(title, quantity, unit_price)')
          .eq('customer_id', user!.id)
          .order('created_at', { ascending: false });

        // Apply time period filter
        const now = new Date();
        if (period === '6months') {
          const cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString();
          query = query.gte('created_at', cutoff);
        } else if (period === '1year') {
          const cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();
          query = query.gte('created_at', cutoff);
        } else if (period === '2025') {
          query = query.gte('created_at', '2025-01-01T00:00:00Z').lt('created_at', '2026-01-01T00:00:00Z');
        } else if (period === '2024') {
          query = query.gte('created_at', '2024-01-01T00:00:00Z').lt('created_at', '2025-01-01T00:00:00Z');
        }
        // 'all' — no date filter

        const { data, error } = await query;
        if (error) {
          console.error('Error loading orders:', error);
          setOrders([]);
        } else {
          setOrders((data as unknown as OrderData[]) || []);
        }
      } catch (err) {
        console.error('Order history error:', err);
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadOrders();
  }, [user?.id, period]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-serif font-bold text-primary mb-2">Order History</h2>
        <p className="text-muted-foreground">View and track all your past purchases.</p>
      </div>

      <div className="flex items-center space-x-4 mb-6">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as TimePeriod)}
          className="bg-white border border-border rounded-lg px-4 py-2 text-sm font-bold text-primary outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="6months">Past 6 Months</option>
          <option value="1year">Past Year</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
          <option value="all">All Orders</option>
        </select>
      </div>

      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-muted-foreground" />
          </div>
        ) : orders.length > 0 ? (
          orders.map((order) => (
            <OrderItem key={order.id} order={order} />
          ))
        ) : (
          <div className="text-center py-16">
            <Package size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-bold text-primary mb-2">No orders found</p>
            <p className="text-sm text-muted-foreground mb-6">
              {period === 'all' ? "You haven't placed any orders yet." : 'No orders in this time period.'}
            </p>
            <Link to="/shop" className="inline-block bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all">
              Browse the Shop
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
