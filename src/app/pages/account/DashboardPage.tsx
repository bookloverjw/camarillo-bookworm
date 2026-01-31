import React from 'react';
import { motion } from 'motion/react';
import { Heart, Package, Calendar, MapPin, ChevronRight, BookOpen } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { Link } from 'react-router';

export const DashboardPage = () => {
  const { user } = useAuth();

  const stats = [
    { label: 'Wishlist Items', value: '12', icon: Heart, color: 'text-pink-500', bg: 'bg-pink-50' },
    { label: 'Past Orders', value: '4', icon: Package, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Events RSVP', value: '2', icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-serif font-bold text-primary mb-2">Welcome back, {user?.firstName}!</h2>
        <p className="text-muted-foreground">Here's what's happening with your library.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <motion.div 
            key={stat.label}
            whileHover={{ y: -5 }}
            className="p-6 bg-white rounded-2xl border border-border shadow-sm flex items-center space-x-4"
          >
            <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{stat.value}</p>
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
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-16 h-20 bg-muted rounded overflow-hidden">
                <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary/30">
                  <BookOpen size={24} />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Order #88219</p>
                <h4 className="font-serif font-bold text-primary leading-tight">The Heaven & Earth Grocery Store</h4>
                <div className="mt-2 inline-block px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-full uppercase tracking-widest">
                  Ready for Pickup
                </div>
              </div>
            </div>
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
                <span className="font-bold">10:00 AM - 8:00 PM</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/50">Next Event:</span>
                <span className="font-bold">Author Talk • Feb 12</span>
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
