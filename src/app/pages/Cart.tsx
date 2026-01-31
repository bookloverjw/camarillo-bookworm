import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Plus, Minus, ArrowLeft, ShoppingBag, CreditCard, ExternalLink, Truck, Shield, Gift } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { toast } from 'sonner';
import { useCart, getBookshopAffiliateUrl, BOOKSHOP_AFFILIATE_ID } from '@/app/context/CartContext';
import { useAuth } from '@/app/context/AuthContext';

export const Cart = () => {
  const {
    items,
    itemCount,
    subtotal,
    tax,
    shipping,
    total,
    updateQuantity,
    removeItem,
    clearCart,
    getBookshopCartUrl,
  } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleRemoveItem = (id: string, title: string) => {
    removeItem(id);
    toast.success(`"${title}" removed from cart`);
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    navigate('/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-8">
            <ShoppingBag size={40} className="text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-primary mb-4">Your bag is empty</h1>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            It looks like you haven't added any books to your collection yet. Let's find some new stories!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/shop"
              className="inline-flex items-center space-x-2 bg-primary text-white px-8 py-4 rounded-xl font-bold hover:bg-primary/90 transition-all"
            >
              <ArrowLeft size={18} />
              <span>Browse Our Selection</span>
            </Link>
            <a
              href={`https://bookshop.org/shop/${BOOKSHOP_AFFILIATE_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 bg-secondary text-white px-8 py-4 rounded-xl font-bold hover:bg-secondary/90 transition-all"
            >
              <span>Shop on Bookshop.org</span>
              <ExternalLink size={18} />
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="py-12 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-primary">Your Shopping Bag</h1>
            <p className="text-muted-foreground mt-1">{itemCount} {itemCount === 1 ? 'item' : 'items'}</p>
          </div>
          <Link to="/shop" className="text-accent font-bold hover:underline flex items-center">
            <ArrowLeft size={16} className="mr-2" /> Continue Shopping
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          {/* Items List */}
          <div className="lg:col-span-8 space-y-6">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 bg-white rounded-2xl border border-border shadow-sm group"
                >
                  {/* Book Cover */}
                  <div className="w-24 aspect-[2/3] shrink-0 rounded-lg shadow-md overflow-hidden">
                    <Link to={`/book/${item.id}`}>
                      <ImageWithFallback src={item.cover} alt={item.title} className="w-full h-full object-cover" />
                    </Link>
                  </div>

                  {/* Book Info */}
                  <div className="flex-grow space-y-2 text-center sm:text-left">
                    <Link to={`/book/${item.id}`}>
                      <h3 className="text-xl font-serif font-bold text-primary hover:text-accent transition-colors">{item.title}</h3>
                    </Link>
                    <p className="text-sm text-muted-foreground italic">by {item.author}</p>
                    <p className="text-xs font-bold text-accent uppercase tracking-widest mt-2">{item.type}</p>

                    {/* Bookshop.org Link */}
                    {item.isbn && (
                      <a
                        href={getBookshopAffiliateUrl(item.isbn)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-[10px] text-muted-foreground hover:text-secondary transition-colors mt-2"
                      >
                        <span>Also on Bookshop.org</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center border border-border rounded-lg bg-muted/30">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-2 hover:text-accent transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-10 text-center font-bold text-primary">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-2 hover:text-accent transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item.id, item.title)}
                      className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  {/* Price */}
                  <div className="text-right min-w-[80px]">
                    <p className="font-bold text-lg text-primary">${(item.price * item.quantity).toFixed(2)}</p>
                    {item.quantity > 1 && (
                      <p className="text-[10px] text-muted-foreground mt-1">${item.price.toFixed(2)} each</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Clear Cart */}
            {items.length > 1 && (
              <div className="text-right">
                <button
                  onClick={() => {
                    clearCart();
                    toast.success('Cart cleared');
                  }}
                  className="text-sm text-muted-foreground hover:text-red-500 transition-colors"
                >
                  Clear all items
                </button>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-4">
            <div className="bg-muted p-8 rounded-3xl border border-border sticky top-28">
              <h2 className="text-2xl font-serif font-bold text-primary mb-8">Order Summary</h2>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="text-primary font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span className="text-primary font-medium">
                    {shipping === 0 ? (
                      <span className="text-green-600">FREE</span>
                    ) : (
                      `$${shipping.toFixed(2)}`
                    )}
                  </span>
                </div>
                {shipping > 0 && subtotal < 50 && (
                  <p className="text-xs text-accent">Add ${(50 - subtotal).toFixed(2)} more for free shipping!</p>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Estimated Tax</span>
                  <span className="text-primary font-medium">${tax.toFixed(2)}</span>
                </div>
                <div className="pt-4 border-t border-border flex justify-between items-baseline">
                  <span className="font-bold text-primary text-lg">Total</span>
                  <span className="text-2xl font-serif font-bold text-accent">${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <div className="space-y-4">
                <button
                  onClick={handleCheckout}
                  className="w-full bg-primary text-white py-5 rounded-2xl font-bold flex items-center justify-center space-x-3 hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
                >
                  <CreditCard size={20} />
                  <span>Checkout Now</span>
                </button>

                {/* Trust Badges */}
                <div className="flex items-center justify-center space-x-4 pt-4">
                  <div className="flex items-center space-x-1 text-[10px] text-muted-foreground">
                    <Shield size={14} className="text-green-600" />
                    <span>Secure</span>
                  </div>
                  <div className="flex items-center space-x-1 text-[10px] text-muted-foreground">
                    <Truck size={14} className="text-accent" />
                    <span>Fast Shipping</span>
                  </div>
                  <div className="flex items-center space-x-1 text-[10px] text-muted-foreground">
                    <Gift size={14} className="text-secondary" />
                    <span>Gift Wrap</span>
                  </div>
                </div>
              </div>

              {/* Bookshop.org Affiliate Banner */}
              <div className="mt-8 p-4 bg-white/50 rounded-xl border border-accent/10">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center shrink-0">
                    <ShoppingBag size={14} className="text-secondary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary mb-1">Can't pick it up?</p>
                    <p className="text-[10px] leading-relaxed text-muted-foreground mb-3">
                      Order through our Bookshop.org affiliate page for direct shipping. We still earn a portion of every sale!
                    </p>
                    <a
                      href={getBookshopCartUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-xs font-bold text-secondary hover:underline"
                    >
                      <span>Shop on Bookshop.org</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
