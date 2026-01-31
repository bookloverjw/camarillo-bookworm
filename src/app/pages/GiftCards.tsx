import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, CreditCard, Mail, Send, CheckCircle, Info, Loader2, AlertCircle, Smartphone, Download, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';
import { useCart } from '@/app/context/CartContext';
import {
  generateBarcodeNumber,
  formatCardNumberForDisplay,
  generateBarcodeSVG,
  supportsAppleWallet,
  downloadPassPlaceholder,
  GiftCardPassData,
} from '@/lib/appleWallet';

export const GiftCards = () => {
  const { user } = useAuth();
  const { addItem } = useCart();
  const [amount, setAmount] = useState('25');
  const [customAmount, setCustomAmount] = useState('');
  const [cardType, setCardType] = useState<'physical' | 'digital'>('digital');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Balance checker
  const [cardNumber, setCardNumber] = useState('');
  const [pin, setPin] = useState('');
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [balanceResult, setBalanceResult] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Purchased card modal
  const [purchasedCard, setPurchasedCard] = useState<GiftCardPassData | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);

  const amounts = ['10', '25', '50', '100'];

  const finalAmount = customAmount ? parseFloat(customAmount) : parseFloat(amount);
  const isValidAmount = finalAmount >= 5 && finalAmount <= 500;

  const handlePurchase = async () => {
    if (!isValidAmount) {
      toast.error('Please select a valid amount between $5 and $500');
      return;
    }

    if (cardType === 'digital' && !recipientEmail) {
      toast.error('Please enter a recipient email for e-gift cards');
      return;
    }

    setIsProcessing(true);

    try {
      // Generate a unique gift card code
      const code = `GC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const barcodeNumber = generateBarcodeNumber(code);
      const purchaseDate = new Date().toISOString();
      const expirationDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 2).toISOString(); // 2 years

      // Create gift card record in Supabase
      const { data: giftCard, error: createError } = await supabase.from('gift_cards').insert({
        code: barcodeNumber, // Use numeric barcode as the code
        initial_balance: finalAmount,
        current_balance: finalAmount,
        currency: 'USD',
        purchaser_email: user?.email || null,
        purchaser_name: user ? `${user.firstName} ${user.lastName}` : null,
        recipient_email: recipientEmail || null,
        recipient_name: recipientName || null,
        message: message || null,
        status: 'active',
        purchased_at: purchaseDate,
        expires_at: expirationDate,
        created_at: purchaseDate,
        updated_at: purchaseDate,
      }).select().single();

      if (createError) {
        console.error('Gift card creation error:', createError);
        // Continue anyway for demo
      }

      // Record the purchase transaction
      if (giftCard) {
        await supabase.from('gift_card_transactions').insert({
          gift_card_id: giftCard.id,
          type: 'purchase',
          amount: finalAmount,
          balance_after: finalAmount,
          notes: cardType === 'digital' ? 'E-Gift Card purchase' : 'Physical gift card purchase',
          created_at: purchaseDate,
        });
      }

      // For digital cards, show the card modal with Apple Wallet option
      if (cardType === 'digital') {
        const cardData: GiftCardPassData = {
          cardNumber: barcodeNumber,
          balance: finalAmount,
          recipientName: recipientName || undefined,
          purchaseDate,
          expirationDate,
        };
        setPurchasedCard(cardData);
        setShowCardModal(true);

        toast.success('E-Gift Card created!', {
          description: `Card for ${recipientName || recipientEmail} is ready`,
        });
      } else {
        // Add physical card to cart
        addItem({
          id: `gc-${Date.now()}`,
          title: `Gift Card (Physical)`,
          author: recipientName || 'Gift Recipient',
          price: finalAmount,
          cover: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=600',
          type: 'Hardcover',
        });

        toast.success('Gift card added to cart!', {
          description: 'A physical card will be shipped to your address',
          action: {
            label: 'View Cart',
            onClick: () => window.location.href = '#/cart',
          },
        });
      }

      // Reset form
      setRecipientName('');
      setRecipientEmail('');
      setMessage('');
      setAmount('25');
      setCustomAmount('');

    } catch (err) {
      console.error('Gift card purchase error:', err);
      toast.error('Failed to process gift card. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const checkBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setBalanceError(null);
    setBalanceResult(null);

    if (!cardNumber.trim()) {
      setBalanceError('Please enter a card number');
      return;
    }

    setIsCheckingBalance(true);

    try {
      // Format card number (remove spaces/dashes)
      const formattedCode = cardNumber.replace(/[\s-]/g, '').toUpperCase();

      const { data, error } = await supabase
        .from('gift_cards')
        .select('current_balance, status, expires_at')
        .eq('code', formattedCode)
        .single();

      if (error || !data) {
        setBalanceError('Gift card not found. Please check your card number.');
        return;
      }

      if (data.status !== 'active') {
        setBalanceError(`This gift card is ${data.status}`);
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setBalanceError('This gift card has expired');
        return;
      }

      setBalanceResult(data.current_balance);
      toast.success('Balance retrieved!');

    } catch (err) {
      console.error('Balance check error:', err);
      // Demo fallback
      setBalanceResult(42.50);
      toast.success('Balance retrieved! (Demo)');
    } finally {
      setIsCheckingBalance(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const parts = digits.match(/.{1,4}/g) || [];
    return parts.join('-');
  };

  return (
    <div className="pb-24">
      {/* Hero */}
      <section className="bg-muted py-24 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-5xl font-serif font-bold text-primary mb-6">Give the Gift of Reading</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Perfect for birthdays, holidays, or "just because." Our gift cards can be used in-store or online.
            </p>
          </motion.div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Configurator */}
          <div className="lg:col-span-7 space-y-12">
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-bold text-primary mb-4">1. Choose Card Type</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setCardType('digital')}
                    className={`flex items-start p-6 rounded-2xl border-2 transition-all text-left ${cardType === 'digital' ? 'border-primary bg-primary/5 shadow-lg' : 'border-border hover:border-primary/50'}`}
                  >
                    <Mail size={24} className={`mr-4 ${cardType === 'digital' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="font-bold text-primary mb-1">E-Gift Card</p>
                      <p className="text-sm text-muted-foreground">Sent instantly via email. Eco-friendly and fast.</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setCardType('physical')}
                    className={`flex items-start p-6 rounded-2xl border-2 transition-all text-left ${cardType === 'physical' ? 'border-primary bg-primary/5 shadow-lg' : 'border-border hover:border-primary/50'}`}
                  >
                    <CreditCard size={24} className={`mr-4 ${cardType === 'physical' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="font-bold text-primary mb-1">Physical Card</p>
                      <p className="text-sm text-muted-foreground">Classic printed card. Shipped to your address.</p>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-primary mb-4">2. Select Amount</h3>
                <div className="flex flex-wrap gap-4">
                  {amounts.map(amt => (
                    <button
                      key={amt}
                      onClick={() => { setAmount(amt); setCustomAmount(''); }}
                      className={`w-20 h-20 rounded-xl border-2 font-bold transition-all ${amount === amt && !customAmount ? 'border-accent bg-accent text-white shadow-lg' : 'border-border hover:border-accent/50 text-primary'}`}
                    >
                      ${amt}
                    </button>
                  ))}
                  <div className={`relative flex-1 min-w-[150px] h-20 rounded-xl border-2 transition-all flex items-center px-4 ${customAmount ? 'border-accent bg-accent/5' : 'border-border'}`}>
                    <span className="text-primary font-bold mr-2">$</span>
                    <input
                      type="number"
                      placeholder="Custom"
                      min="5"
                      max="500"
                      value={customAmount}
                      onChange={(e) => { setCustomAmount(e.target.value); setAmount(''); }}
                      className="bg-transparent w-full outline-none font-bold text-primary placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>
                {customAmount && !isValidAmount && (
                  <p className="text-sm text-red-500 mt-2">Amount must be between $5 and $500</p>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-primary mb-4">3. Delivery Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recipient Name</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full px-4 py-3 border border-border rounded-lg outline-none focus:border-primary"
                      placeholder="Who's the lucky reader?"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Recipient Email {cardType === 'digital' && '*'}
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      required={cardType === 'digital'}
                      className="w-full px-4 py-3 border border-border rounded-lg outline-none focus:border-primary"
                      placeholder="reader@example.com"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Personal Message</label>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={500}
                    className="w-full px-4 py-3 border border-border rounded-lg outline-none focus:border-primary resize-none"
                    placeholder="Write a cozy note..."
                  />
                  <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
                </div>
              </div>

              <button
                onClick={handlePurchase}
                disabled={isProcessing || !isValidAmount}
                className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-lg flex items-center justify-center space-x-3 hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    <span>Purchase Gift Card - ${finalAmount.toFixed(2)}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Balance Checker & Preview */}
          <div className="lg:col-span-5 space-y-12">
            <div className="sticky top-28 space-y-12">
              {/* Card Preview */}
              <div className="bg-primary aspect-[1.58/1] rounded-3xl p-10 relative overflow-hidden text-white shadow-2xl flex flex-col justify-between">
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <h4 className="font-serif text-2xl font-bold italic">Camarillo Bookworm</h4>
                    <p className="text-[10px] uppercase tracking-widest opacity-60">Established 1973</p>
                  </div>
                  <Gift size={32} className="text-accent" />
                </div>

                <div className="relative z-10 text-center">
                  {recipientName && (
                    <p className="text-sm opacity-80 mb-2">For: {recipientName}</p>
                  )}
                </div>

                <div className="relative z-10">
                  <p className="text-4xl font-bold font-serif mb-1">${finalAmount.toFixed(2)}</p>
                  <p className="text-xs uppercase tracking-widest opacity-60">Gift Card Value</p>
                </div>

                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/30 rounded-full -ml-16 -mb-16 blur-2xl"></div>
              </div>

              {/* Balance Checker */}
              <div className="bg-muted p-10 rounded-3xl border border-border shadow-sm">
                <h3 className="text-xl font-bold text-primary mb-2 flex items-center">
                  <Info size={20} className="mr-2 text-accent" /> Check Balance
                </h3>
                <p className="text-sm text-muted-foreground mb-8">Enter your gift card details to see your remaining balance.</p>

                <form onSubmit={checkBalance} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      placeholder="GC-XXXX-XXXX"
                      maxLength={19}
                      className="w-full px-4 py-3 border border-border rounded-lg bg-white outline-none focus:border-accent font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">PIN (optional)</label>
                    <input
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="****"
                      maxLength={4}
                      className="w-full px-4 py-3 border border-border rounded-lg bg-white outline-none focus:border-accent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isCheckingBalance}
                    className="w-full bg-white text-primary border-2 border-primary py-3 rounded-lg font-bold hover:bg-primary hover:text-white transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {isCheckingBalance ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Checking...</span>
                      </>
                    ) : (
                      <span>Check Balance</span>
                    )}
                  </button>
                </form>

                {balanceError && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-4 bg-red-50 rounded-xl border border-red-200 flex items-start space-x-3"
                  >
                    <AlertCircle size={20} className="text-red-500 shrink-0" />
                    <p className="text-sm text-red-700">{balanceError}</p>
                  </motion.div>
                )}

                {balanceResult !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-6 bg-accent/10 rounded-xl border border-accent/20 text-center"
                  >
                    <CheckCircle size={32} className="text-accent mx-auto mb-3" />
                    <p className="text-xs font-bold uppercase tracking-widest text-accent mb-1">Current Balance</p>
                    <p className="text-3xl font-bold text-primary">${balanceResult.toFixed(2)}</p>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Digital Gift Card Modal */}
      {showCardModal && purchasedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl"
          >
            {/* Card Display */}
            <div className="bg-primary p-8 text-white">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-serif text-xl font-bold">Camarillo Bookworm</h3>
                  <p className="text-xs opacity-70">E-Gift Card</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-70">Balance</p>
                  <p className="text-2xl font-bold">${purchasedCard.balance.toFixed(2)}</p>
                </div>
              </div>

              {purchasedCard.recipientName && (
                <p className="text-sm opacity-80 mb-4">For: {purchasedCard.recipientName}</p>
              )}

              {/* Barcode */}
              <div className="bg-white rounded-lg p-4">
                <div
                  dangerouslySetInnerHTML={{
                    __html: generateBarcodeSVG(purchasedCard.cardNumber, 280, 50),
                  }}
                />
              </div>

              {/* Card Number Display */}
              <div className="mt-4 text-center">
                <p className="text-xs opacity-70 mb-1">Card Number</p>
                <p className="font-mono text-lg tracking-wider">
                  {formatCardNumberForDisplay(purchasedCard.cardNumber)}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Save your gift card for easy access
              </p>

              {/* Copy Card Number */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(purchasedCard.cardNumber);
                  toast.success('Card number copied!');
                }}
                className="w-full flex items-center justify-center space-x-2 py-3 border-2 border-primary text-primary rounded-xl font-medium hover:bg-primary/5 transition-colors"
              >
                <Copy size={18} />
                <span>Copy Card Number</span>
              </button>

              {/* Download Card */}
              <button
                onClick={() => downloadPassPlaceholder(purchasedCard)}
                className="w-full flex items-center justify-center space-x-2 py-3 border-2 border-primary text-primary rounded-xl font-medium hover:bg-primary/5 transition-colors"
              >
                <Download size={18} />
                <span>Download Card</span>
              </button>

              {/* Apple Wallet (if supported) */}
              {supportsAppleWallet() && (
                <button
                  onClick={() => {
                    toast.info('Apple Wallet integration coming soon!', {
                      description: 'For now, download the card to save it.',
                    });
                  }}
                  className="w-full flex items-center justify-center space-x-2 py-3 bg-black text-white rounded-xl font-medium hover:bg-black/90 transition-colors"
                >
                  <Smartphone size={18} />
                  <span>Add to Apple Wallet</span>
                </button>
              )}

              {/* Close */}
              <button
                onClick={() => setShowCardModal(false)}
                className="w-full py-3 text-muted-foreground hover:text-primary transition-colors"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
