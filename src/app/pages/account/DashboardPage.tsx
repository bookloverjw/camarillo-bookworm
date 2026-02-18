import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Heart, Package, Calendar, MapPin, ChevronRight, BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { Link } from 'react-router';
import { getTodayHours } from '@/lib/storeHours';
import { supabase } from '@/lib/supabase';

interface DashboardStats {
  wishlistCount: number;
  orderCount: number;
  eventCount: number;
}

interface RecentOrder {
  orderNumber: string;
  status: string;
  firstItemTitle: string;
}

export const DashboardPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({ wishlistCount: 0, orderCount: 0, eventCount: 0 });
  const [recentOrder, setRecentOrder] = useState<RecentOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setIsLoading(false); return; }

    async function loadDashboard() {
      try {
        // Fetch counts in parallel
        const [wishlistRes, ordersRes, eventsRes, recentOrderRes] = await Promise.all([
          supabase.from('wishlist_items').select('id', { count: 'exact', head: true })
            .in('wishlist_id',
              (await supabase.from('wishlists').select('id').eq('customer_id', user!.id)).data?.map(w => w.id) || []
            ),
          supabase.from('orders').select('id', { count: 'exact', head: true })
            .eq('customer_id', user!.id),
          supabase.from('event_registrations').select('id', { count: 'exact', head: true })
            .eq('customer_id', user!.id),
          supabase.from('orders').select('order_number, status, order_items(title)')
            .eq('customer_id', user!.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single(),
        ]);

        setStats({
          wishlistCount: wishlistRes.count || 0,
          orderCount: ordersRes.count || 0,
          eventCount: eventsRes.count || 0,
        });

        if (recentOrderRes.data) {
          const order = recentOrderRes.data as any;
          const items = order.order_items || [];
          setRecentOrder({
            orderNumber: order.order_number || '—',
            status: order.status || 'Processing',
            firstItemTitle: items[0]?.title || 'Order',
          });
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, [user?.id]);

  const statCards = [
    { label: 'Wishlist Items', value: stats.wishlistCount, icon: Heart, color: 'text-pink-500', bg: 'bg-pink-50' },
    { label: 'Past Orders', value: stats.orderCount, icon: Package, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Events RSVP', value: stats.eventCount, icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-50 text-green-700';
      case 'shipped': return 'bg-blue-50 text-blue-700';
      case 'ready for pickup': return 'bg-purple-50 text-purple-700';
      default: return 'bg-yellow-50 text-yellow-700';
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-serif font-bold text-primary mb-2">Welcome back, {user?.firstName}!</h2>
        <p className="text-muted-foreground">Here's what's happening with your library.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <motion.div
            key={stat.label}
            whileHover={{ y: -5 }}
            className="p-6 bg-white rounded-2xl border border-border shadow-sm flex items-center space-x-4"
          >
            <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : stat.value}
              </p>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Recent Order */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h3 className="font-bold text-primary flex items-center">
              <Package size={18} className="mr-2 text-accent" />
              Recent Order
            </h3>
            <Link to="/account/orders" className="text-xs font-bold text-accent hover:underline flex items-center">
              View All <ChevronRight size={14} />
            </Link>
          </div>
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={24} className="animate-spin text-muted-foreground" />
              </div>
            ) : recentOrder ? (
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-16 h-20 bg-muted rounded overflow-hidden">
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary/30">
                    <BookOpen size={24} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Order {recentOrder.orderNumber}</p>
                  <h4 className="font-serif font-bold text-primary leading-tight">{recentOrder.firstItemTitle}</h4>
                  <div className={`mt-2 inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-widest ${getStatusBadge(recentOrder.status)}`}>
                    {recentOrder.status}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No orders yet. <Link to="/shop" className="text-accent hover:underline">Browse the shop</Link> to get started!</p>
            )}
          </div>
        </div>

        {/* Home Store Info */}
        <div className="bg-primary text-white rounded-2xl p-8 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-6">
              <MapPin size={20} className="text-accent" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Your Local Bookstore</span>
            </div>
            <h3 className="text-2xl font-serif font-bold mb-2">Camarillo Bookworm</h3>
            <p className="text-sm text-white/70 mb-8 max-w-xs leading-relaxed">
              Serving our community since 1973. Your local hub for literature and connection.
            </p>
            <div className="space-y-3">
              <div className="flex justify-between text-xs border-b border-white/10 pb-2">
                <span className="text-white/50">Today's Hours:</span>
                <span className="font-bold">{getTodayHours().hours}</span>
              </div>
            </div>
          </div>
          {/* Decorative background element */}
          <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
        </div>
      </div>
    </div>
  );
};
