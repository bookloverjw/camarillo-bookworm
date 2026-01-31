// Square Web Payments SDK integration for Camarillo Bookworm website
// This handles client-side card tokenization - actual payment processing
// should happen on a secure server (Supabase Edge Function)

export interface SquareSettings {
  applicationId: string;
  locationId: string;
  environment: 'sandbox' | 'production';
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  receiptUrl?: string;
  cardBrand?: string;
  last4?: string;
  error?: {
    code: string;
    message: string;
    detail?: string;
  };
}

export interface CreatePaymentRequest {
  sourceId: string; // Card nonce from Square Web Payments SDK
  amountCents: number;
  currency?: string;
  customerId?: string;
  orderId?: string;
  note?: string;
  referenceId?: string;
  billingAddress?: {
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  buyerEmail?: string;
}

// Generate a unique idempotency key for payment requests
export const generateIdempotencyKey = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

// Square Web Payments SDK loader
let squarePromise: Promise<typeof window.Square> | null = null;

export const loadSquareSdk = (environment: 'sandbox' | 'production'): Promise<typeof window.Square> => {
  if (squarePromise) return squarePromise;

  squarePromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.Square) {
      resolve(window.Square);
      return;
    }

    const script = document.createElement('script');
    script.src = environment === 'sandbox'
      ? 'https://sandbox.web.squarecdn.com/v1/square.js'
      : 'https://web.squarecdn.com/v1/square.js';
    script.async = true;

    script.onload = () => {
      if (window.Square) {
        resolve(window.Square);
      } else {
        reject(new Error('Square SDK failed to load'));
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load Square SDK script'));
    };

    document.head.appendChild(script);
  });

  return squarePromise;
};

// Initialize Square payments
export const initializeSquarePayments = async (
  settings: SquareSettings
): Promise<any> => {
  const Square = await loadSquareSdk(settings.environment);

  const payments = Square.payments(settings.applicationId, settings.locationId);
  return payments;
};

// Create card payment form
export const createCardForm = async (
  payments: any,
  containerId: string
): Promise<any> => {
  const card = await payments.card();
  await card.attach(`#${containerId}`);
  return card;
};

// Tokenize card (get payment nonce)
export const tokenizeCard = async (card: any): Promise<{ token: string; cardBrand: string; last4: string } | null> => {
  try {
    const result = await card.tokenize();

    if (result.status === 'OK') {
      return {
        token: result.token,
        cardBrand: result.details?.card?.brand || 'Unknown',
        last4: result.details?.card?.last4 || '****',
      };
    } else {
      console.error('Tokenization failed:', result.errors);
      return null;
    }
  } catch (error) {
    console.error('Error tokenizing card:', error);
    return null;
  }
};

// Process payment through Supabase Edge Function
// This keeps Square credentials secure on the server
export const processPayment = async (request: CreatePaymentRequest): Promise<PaymentResult> => {
  try {
    const response = await fetch('/api/square/process-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        idempotencyKey: generateIdempotencyKey(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: data.code || 'PAYMENT_ERROR',
          message: data.message || 'Payment failed',
          detail: data.detail,
        },
      };
    }

    return {
      success: true,
      paymentId: data.payment?.id,
      receiptUrl: data.payment?.receipt_url,
      cardBrand: data.payment?.card_details?.card?.card_brand,
      last4: data.payment?.card_details?.card?.last_4,
    };
  } catch (error) {
    console.error('Payment processing error:', error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Failed to process payment. Please try again.',
      },
    };
  }
};

// Square test card numbers (for sandbox)
export const TEST_CARDS = {
  visa: {
    number: '4111 1111 1111 1111',
    cvv: '111',
    expiry: '12/25',
  },
  mastercard: {
    number: '5105 1051 0510 5100',
    cvv: '111',
    expiry: '12/25',
  },
  amex: {
    number: '3400 000000 00009',
    cvv: '1111',
    expiry: '12/25',
  },
  discover: {
    number: '6011 0000 0000 0004',
    cvv: '111',
    expiry: '12/25',
  },
  declined: {
    number: '4000 0000 0000 0002',
    cvv: '111',
    expiry: '12/25',
    note: 'Card will be declined',
  },
};

// Type declarations for Square SDK
declare global {
  interface Window {
    Square: {
      payments: (applicationId: string, locationId: string) => any;
    };
  }
}
