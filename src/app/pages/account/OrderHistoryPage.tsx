import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Package, ChevronDown, ChevronUp, ExternalLink, RefreshCw, HelpCircle, BookOpen } from 'lucide-react';

const OrderItem = ({ order }: any) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Delivered': return 'bg-green-50 text-green-700 border-green-100';
      case 'Shipped': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Processing': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'Ready for Pickup': return 'bg-purple-50 text-purple-700 border-purple-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

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
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-1">Order {order.number}</p>
            <p className="font-bold text-primary">{order.date}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${getStatusColor(order.status)}`}>
            {order.status}
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
                {order.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-14 bg-white border border-border rounded overflow-hidden flex items-center justify-center text-primary/20">
                        <BookOpen size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary leading-tight">{item.title}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.qty}</p>
                      </div>
                    </div>
                    <button className="flex items-center space-x-1 text-[10px] font-bold text-accent uppercase tracking-widest hover:underline">
                      <RefreshCw size={12} />
                      <span>Buy Again</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-border">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Shipping Address</p>
                <p className="text-sm text-primary leading-relaxed">
                  {order.address.name}<br />
                  {order.address.line1}<br />
                  {order.address.city}, {order.address.state} {order.address.zip}
                </p>
              </div>
              <div className="flex flex-col justify-end space-y-3">
                {order.tracking && (
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
  const mockOrders = [
    {
      number: '#88219',
      date: 'Jan 28, 2026',
      status: 'Ready for Pickup',
      total: 28.50,
      items: [{ title: 'The Heaven & Earth Grocery Store', qty: 1 }],
      address: { name: 'Jane Bookworm', line1: '93 E Daily Dr', city: 'Camarillo', state: 'CA', zip: '93010' }
    },
    {
      number: '#88102',
      date: 'Dec 15, 2025',
      status: 'Delivered',
      total: 64.22,
      items: [
        { title: 'Demon Copperhead', qty: 1 },
        { title: 'Fourth Wing', qty: 1 }
      ],
      tracking: '940011189956223400',
      address: { name: 'Jane Bookworm', line1: '93 E Daily Dr', city: 'Camarillo', state: 'CA', zip: '93010' }
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-serif font-bold text-primary mb-2">Order History</h2>
        <p className="text-muted-foreground">View and track all your past purchases.</p>
      </div>

      <div className="flex items-center space-x-4 mb-6">
        <select className="bg-white border border-border rounded-lg px-4 py-2 text-sm font-bold text-primary outline-none focus:ring-1 focus:ring-accent">
          <option>Past 6 Months</option>
          <option>Past Year</option>
          <option>2025</option>
          <option>2024</option>
        </select>
      </div>

      <div>
        {mockOrders.map((order, idx) => (
          <OrderItem key={idx} order={order} />
        ))}
      </div>
    </div>
  );
};
