import React, { useState } from 'react';
import { Link } from 'react-router';
import { Lock, AlertTriangle } from 'lucide-react';
import { STORE } from '@/lib/storeConfig';

// The site is still in development and cannot take real payments, but visitors
// were reaching the Square test card form and believing they had bought a book.
// This gate keeps them out of it. Set REQUIRE_DEV_PASSWORD to false once real
// payments are live and checkout should be open to everyone.
//
// Note this is a speed bump, not security: the password lives in the client
// bundle and anyone who reads it can get past. It exists to stop honest
// confusion, which is the actual problem here.
export const REQUIRE_DEV_PASSWORD = true;

const DEV_PASSWORD = '1234';
const STORAGE_KEY = 'bookworm-checkout-unlocked';

const readUnlocked = () => {
  if (!REQUIRE_DEV_PASSWORD) return true;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false; // private mode / storage blocked - just ask again
  }
};

export const CheckoutGate = ({ children }: { children: React.ReactNode }) => {
  const [unlocked, setUnlocked] = useState(readUnlocked);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password.trim() !== DEV_PASSWORD) {
      setError(true);
      setPassword('');
      return;
    }

    try {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Not persisting is fine - they stay unlocked for this render at least
    }
    setUnlocked(true);
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="py-12">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-card rounded-3xl border border-border p-8 sm:p-10 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-yellow-50 border border-yellow-300 flex items-center justify-center mb-6">
            <AlertTriangle size={26} className="text-yellow-600" />
          </div>

          <h1 className="text-2xl font-serif font-bold text-primary mb-3">
            This site is still in development
          </h1>

          <p className="text-muted-foreground mb-4">
            Checkout is <span className="font-bold text-foreground">not ready to take payments</span>.
            The card form beyond this point is a Square test form — it cannot charge your card and it
            will not place a real order or reserve any books.
          </p>

          <p className="text-muted-foreground mb-8">
            To buy a book today, call us at{' '}
            <a href={STORE.phoneTel} className="text-primary font-bold hover:underline">
              {STORE.phone}
            </a>{' '}
            or stop by {STORE.address.line1}. Sorry for the detour, and thanks for your patience
            while we build this out.
          </p>

          <form onSubmit={handleSubmit} className="border-t border-border pt-8">
            <label htmlFor="dev-password" className="block text-sm font-bold text-primary mb-2">
              Staff and testers only
            </label>
            <p className="text-sm text-muted-foreground mb-4">
              Enter the testing password to continue to the checkout form.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-grow">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  id="dev-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(false);
                  }}
                  autoFocus
                  aria-invalid={error}
                  aria-describedby={error ? 'dev-password-error' : undefined}
                  placeholder="Testing password"
                  className="w-full pl-10 pr-4 py-3 bg-muted/30 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors"
              >
                Continue
              </button>
            </div>

            {error && (
              <p id="dev-password-error" role="alert" className="mt-3 text-sm text-destructive">
                That password isn't right. Check with the store if you need it.
              </p>
            )}
          </form>

          <div className="mt-8">
            <Link to="/cart" className="text-muted-foreground hover:text-primary">
              ← Back to cart
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
