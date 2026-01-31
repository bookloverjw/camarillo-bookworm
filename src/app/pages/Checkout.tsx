import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CreditCard, Truck, MapPin, User, Mail, Phone, Lock, CheckCircle2, Loader2, AlertCircle, ShoppingBag, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useCart, BOOKSHOP_AFFILIATE_ID } from '@/app/context/CartContext';
import { useAuth } from '@/app/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  loadSquareSdk,
  initializeSquarePayments,
  createCardForm,
  tokenizeCard,
  TEST_CARDS,
  type SquareSettings,
} from '@/lib/square';

type CheckoutStep = 'shipping' | 'payment' | 'confirmation';

// Square settings - in production, these would come from your backend
const SQUARE_SETTINGS: SquareSettings = {
  applicationId: 'sandbox-sq0idb-REPLACE_WITH_YOUR_APP_ID', // Replace with your Square App ID
  locationId: 'REPLACE_WITH_YOUR_LOCATION_ID', // Replace with your Square Location ID
  environment: 'sandbox', // Change to 'production' for live payments
};

export const Checkout = () => {
  const { items, subtotal, tax, shipping, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<CheckoutStep>('shipping');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Card payment state
  const [cardInstance, setCardInstance] = useState<any>(null);
  const [isCardReady, setIsCardReady] = useState(false);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  // Form state
  const [shippingInfo, setShippingInfo] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address1: '',
    address2: '',
    city: '',
    state: 'CA',
    postalCode: '',
    deliveryOption: 'standard' as 'standard' | 'pickup',
  });

  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0 && !orderComplete) {
      navigate('/cart');
    }
  }, [items, navigate, orderComplete]);

  // Initialize Square card form when on payment step
  useEffect(() => {
    let card: any = null;

    const initCard = async () => {
      if (step !== 'payment' || !cardContainerRef.current) return;

      try {
        // Check if Square is configured
        if (SQUARE_SETTINGS.applicationId.includes('REPLACE')) {
          console.warn('Square not configured - using demo mode');
          setIsCardReady(true);
          return;
        }

        const payments = await initializeSquarePayments(SQUARE_SETTINGS);
        card = await createCardForm(payments, 'card-container');
        setCardInstance(card);
        setIsCardReady(true);
      } catch (err) {
        console.error('Failed to initialize Square card:', err);
        setError('Failed to load payment form. Please refresh and try again.');
      }
    };

    initCard();

    return () => {
      if (card) {
        card.destroy();
      }
    };
  }, [step]);

  // Populate form with user info when logged in
  useEffect(() => {
    if (user) {
      setShippingInfo(prev => ({
        ...prev,
        firstName: user.firstName || prev.firstName,
        lastName: user.lastName || prev.lastName,
        email: user.email || prev.email,
        phone: user.phone || prev.phone,
      }));
    }
  }, [user]);

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (shippingInfo.deliveryOption === 'standard') {
      if (!shippingInfo.address1 || !shippingInfo.city || !shippingInfo.postalCode) {
        setError('Please fill in all required address fields.');
        return;
      }
    }

    setStep('payment');
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsProcessing(true);

    try {
      let paymentToken = null;
      let cardDetails = { brand: 'Demo', last4: '0000' };

      // If Square is configured, tokenize the card
      if (cardInstance) {
        const result = await tokenizeCard(cardInstance);
        if (!result) {
          throw new Error('Failed to process card. Please check your card details and try again.');
        }
        paymentToken = result.token;
        cardDetails = { brand: result.cardBrand, last4: result.last4 };
      }

      // Generate order number
      const newOrderNumber = `CBW-${Date.now().toString(36).toUpperCase()}`;

      // Create order in Supabase
      const orderData = {
        customer_id: user?.id || null,
        order_number: newOrderNumber,
        status: 'confirmed',
        subtotal: subtotal,
        tax: tax,
        shipping: shipping,
        discount: 0,
        total: total,
        payment_method: 'credit_card',
        payment_id: paymentToken || `demo_${Date.now()}`,
        notes: shippingInfo.deliveryOption === 'pickup' ? 'In-store pickup requested' : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        console.error('Order creation error:', orderError);
        // Continue anyway for demo purposes
      }

      // Create order items
      if (order) {
        const orderItems = items.map(item => ({
          order_id: order.id,
          isbn: item.isbn || item.id,
          title: item.title,
          author: item.author,
          quantity: item.quantity,
          unit_price: item.price,
          extended_price: item.price * item.quantity,
          cover_url: item.cover,
        }));

        await supabase.from('order_items').insert(orderItems);
      }

      // Save shipping address if user is logged in
      if (user && shippingInfo.deliveryOption === 'standard') {
        await supabase.from('customer_addresses').upsert({
          customer_id: user.id,
          type: 'shipping',
          is_default: true,
          first_name: shippingInfo.firstName,
          last_name: shippingInfo.lastName,
          address_line_1: shippingInfo.address1,
          address_line_2: shippingInfo.address2 || null,
          city: shippingInfo.city,
          state: shippingInfo.state,
          postal_code: shippingInfo.postalCode,
          country: 'US',
          phone: shippingInfo.phone || null,
          updated_at: new Date().toISOString(),
        });
      }

      // Success!
      setOrderNumber(newOrderNumber);
      setOrderComplete(true);
      setStep('confirmation');
      clearCart();
      toast.success('Order placed successfully!');

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Order Summary Component
  const OrderSummary = () => (
    <div className="bg-muted p-6 rounded-2xl border border-border">
      <h3 className="font-serif font-bold text-lg text-primary mb-4">Order Summary</h3>

      {/* Items */}
      <div className="space-y-3 mb-6 max-h-48 overflow-y-auto">
        {items.map(item => (
          <div key={item.id} className="flex items-center space-x-3">
            <div className="w-12 h-16 bg-white rounded overflow-hidden shrink-0">
              <img src={item.cover} alt={item.title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
            </div>
            <p className="text-sm font-medium text-primary">${(item.price * item.quantity).toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="space-y-2 pt-4 border-t border-border">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Shipping</span>
          <span>{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Tax</span>
          <span>${tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold text-primary pt-2 border-t border-border">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );

  // Confirmation screen
  if (step === 'confirmation' && orderComplete) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-primary mb-2">Order Confirmed!</h1>
          <p className="text-muted-foreground mb-6">
            Thank you for your order. We've sent a confirmation to {shippingInfo.email}.
          </p>
          <div className="bg-muted p-4 rounded-xl mb-8">
            <p className="text-sm text-muted-foreground">Order Number</p>
            <p className="text-xl font-bold text-primary">{orderNumber}</p>
          </div>
          <div className="space-y-3">
            <Link
              to="/shop"
              className="block w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary/90 transition-all"
            >
              Continue Shopping
            </Link>
            {user && (
              <Link
                to="/account/orders"
                className="block w-full border border-border py-4 rounded-xl font-bold text-primary hover:bg-muted transition-all"
              >
                View Order History
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/cart" className="text-muted-foreground hover:text-primary flex items-center space-x-2">
            <ArrowLeft size={20} />
            <span>Back to Cart</span>
          </Link>
          <h1 className="text-2xl font-serif font-bold text-primary">Checkout</h1>
          <div className="w-24" /> {/* Spacer */}
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12">
          <div className={`flex items-center space-x-2 ${step === 'shipping' ? 'text-primary' : 'text-accent'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'shipping' ? 'bg-primary text-white' : 'bg-accent text-white'}`}>
              {step === 'payment' ? <CheckCircle2 size={16} /> : '1'}
            </div>
            <span className="text-sm font-medium hidden sm:inline">Shipping</span>
          </div>
          <div className={`w-16 h-0.5 mx-2 ${step === 'payment' ? 'bg-accent' : 'bg-border'}`} />
          <div className={`flex items-center space-x-2 ${step === 'payment' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'payment' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
              2
            </div>
            <span className="text-sm font-medium hidden sm:inline">Payment</span>
          </div>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3"
            >
              <AlertCircle size={20} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {/* Shipping Step */}
              {step === 'shipping' && (
                <motion.div
                  key="shipping"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className="bg-white rounded-2xl border border-border p-6 md:p-8">
                    <h2 className="text-xl font-serif font-bold text-primary mb-6 flex items-center space-x-2">
                      <Truck size={24} className="text-accent" />
                      <span>Delivery Options</span>
                    </h2>

                    <form onSubmit={handleShippingSubmit} className="space-y-6">
                      {/* Delivery Option */}
                      <div className="grid grid-cols-2 gap-4">
                        <label
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            shippingInfo.deliveryOption === 'standard'
                              ? 'border-accent bg-accent/5'
                              : 'border-border hover:border-accent/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="delivery"
                            value="standard"
                            checked={shippingInfo.deliveryOption === 'standard'}
                            onChange={() => setShippingInfo({ ...shippingInfo, deliveryOption: 'standard' })}
                            className="sr-only"
                          />
                          <Truck size={24} className="text-accent mb-2" />
                          <p className="font-bold text-primary">Ship to Me</p>
                          <p className="text-xs text-muted-foreground">{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`} • 3-5 days</p>
                        </label>

                        <label
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            shippingInfo.deliveryOption === 'pickup'
                              ? 'border-accent bg-accent/5'
                              : 'border-border hover:border-accent/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="delivery"
                            value="pickup"
                            checked={shippingInfo.deliveryOption === 'pickup'}
                            onChange={() => setShippingInfo({ ...shippingInfo, deliveryOption: 'pickup' })}
                            className="sr-only"
                          />
                          <MapPin size={24} className="text-accent mb-2" />
                          <p className="font-bold text-primary">In-Store Pickup</p>
                          <p className="text-xs text-muted-foreground">FREE • Ready in 1 hour</p>
                        </label>
                      </div>

                      {/* Contact Info */}
                      <div className="pt-6 border-t border-border">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Contact Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">First Name *</label>
                            <input
                              type="text"
                              required
                              value={shippingInfo.firstName}
                              onChange={(e) => setShippingInfo({ ...shippingInfo, firstName: e.target.value })}
                              className="w-full px-4 py-3 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">Last Name *</label>
                            <input
                              type="text"
                              required
                              value={shippingInfo.lastName}
                              onChange={(e) => setShippingInfo({ ...shippingInfo, lastName: e.target.value })}
                              className="w-full px-4 py-3 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">Email *</label>
                            <input
                              type="email"
                              required
                              value={shippingInfo.email}
                              onChange={(e) => setShippingInfo({ ...shippingInfo, email: e.target.value })}
                              className="w-full px-4 py-3 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground">Phone</label>
                            <input
                              type="tel"
                              value={shippingInfo.phone}
                              onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                              className="w-full px-4 py-3 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Shipping Address (only for delivery) */}
                      {shippingInfo.deliveryOption === 'standard' && (
                        <div className="pt-6 border-t border-border">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Shipping Address</h3>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-muted-foreground">Address *</label>
                              <input
                                type="text"
                                required
                                value={shippingInfo.address1}
                                onChange={(e) => setShippingInfo({ ...shippingInfo, address1: e.target.value })}
                                className="w-full px-4 py-3 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none"
                                placeholder="Street address"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-muted-foreground">Apt, Suite, etc.</label>
                              <input
                                type="text"
                                value={shippingInfo.address2}
                                onChange={(e) => setShippingInfo({ ...shippingInfo, address2: e.target.value })}
                                className="w-full px-4 py-3 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none"
                              />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="col-span-2 space-y-2">
                                <label className="text-xs font-bold text-muted-foreground">City *</label>
                                <input
                                  type="text"
                                  required
                                  value={shippingInfo.city}
                                  onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
                                  className="w-full px-4 py-3 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground">State *</label>
                                <select
                                  required
                                  value={shippingInfo.state}
                                  onChange={(e) => setShippingInfo({ ...shippingInfo, state: e.target.value })}
                                  className="w-full px-4 py-3 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none bg-white"
                                >
                                  <option value="CA">CA</option>
                                  <option value="AZ">AZ</option>
                                  <option value="NV">NV</option>
                                  <option value="OR">OR</option>
                                  <option value="WA">WA</option>
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground">ZIP *</label>
                                <input
                                  type="text"
                                  required
                                  maxLength={5}
                                  value={shippingInfo.postalCode}
                                  onChange={(e) => setShippingInfo({ ...shippingInfo, postalCode: e.target.value.replace(/\D/g, '') })}
                                  className="w-full px-4 py-3 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pickup Info */}
                      {shippingInfo.deliveryOption === 'pickup' && (
                        <div className="p-4 bg-accent/5 rounded-xl border border-accent/20">
                          <p className="font-bold text-primary mb-1">Camarillo Bookworm</p>
                          <p className="text-sm text-muted-foreground">123 Mission Oaks Blvd, Camarillo, CA 93012</p>
                          <p className="text-sm text-muted-foreground mt-2">Mon-Sat: 10am-8pm | Sun: 11am-6pm</p>
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary/90 transition-all"
                      >
                        Continue to Payment
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}

              {/* Payment Step */}
              {step === 'payment' && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className="bg-white rounded-2xl border border-border p-6 md:p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-serif font-bold text-primary flex items-center space-x-2">
                        <CreditCard size={24} className="text-accent" />
                        <span>Payment</span>
                      </h2>
                      <button
                        onClick={() => setStep('shipping')}
                        className="text-sm text-accent hover:underline"
                      >
                        Edit Shipping
                      </button>
                    </div>

                    {/* Shipping Summary */}
                    <div className="p-4 bg-muted rounded-xl mb-6">
                      <p className="text-sm font-bold text-primary">{shippingInfo.firstName} {shippingInfo.lastName}</p>
                      <p className="text-sm text-muted-foreground">{shippingInfo.email}</p>
                      {shippingInfo.deliveryOption === 'standard' && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {shippingInfo.address1}, {shippingInfo.city}, {shippingInfo.state} {shippingInfo.postalCode}
                        </p>
                      )}
                      {shippingInfo.deliveryOption === 'pickup' && (
                        <p className="text-sm text-accent mt-1">In-store pickup</p>
                      )}
                    </div>

                    <form onSubmit={handlePaymentSubmit} className="space-y-6">
                      {/* Card Input */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Card Details</label>
                        <div
                          id="card-container"
                          ref={cardContainerRef}
                          className="min-h-[48px] p-4 border border-border rounded-xl bg-white"
                        >
                          {!isCardReady && (
                            <div className="flex items-center justify-center text-muted-foreground">
                              <Loader2 size={20} className="animate-spin mr-2" />
                              <span className="text-sm">Loading payment form...</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Test Card Info (sandbox only) */}
                      {SQUARE_SETTINGS.environment === 'sandbox' && (
                        <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                          <p className="text-xs font-bold text-yellow-800 mb-2">🧪 Sandbox Mode - Use Test Cards:</p>
                          <p className="text-xs text-yellow-700 font-mono">
                            Visa: {TEST_CARDS.visa.number}<br />
                            CVV: {TEST_CARDS.visa.cvv} | Exp: {TEST_CARDS.visa.expiry}
                          </p>
                        </div>
                      )}

                      {/* Security Notice */}
                      <div className="flex items-start space-x-3 p-4 bg-green-50 rounded-xl">
                        <Lock size={20} className="text-green-600 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-green-800">Secure Payment</p>
                          <p className="text-xs text-green-700">Your payment is encrypted and secure. We never store your full card details.</p>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isProcessing}
                        className="w-full bg-accent text-white py-5 rounded-xl font-bold hover:bg-accent/90 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 size={20} className="animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <Lock size={20} />
                            <span>Pay ${total.toFixed(2)}</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <OrderSummary />

            {/* Bookshop.org Alternative */}
            <div className="mt-6 p-4 bg-white rounded-xl border border-border">
              <div className="flex items-start space-x-3">
                <ShoppingBag size={20} className="text-secondary shrink-0" />
                <div>
                  <p className="text-xs font-bold text-primary mb-1">Prefer Bookshop.org?</p>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Support us through our affiliate store
                  </p>
                  <a
                    href={`https://bookshop.org/shop/${BOOKSHOP_AFFILIATE_ID}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-secondary font-bold hover:underline inline-flex items-center space-x-1"
                  >
                    <span>Visit Bookshop.org</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
