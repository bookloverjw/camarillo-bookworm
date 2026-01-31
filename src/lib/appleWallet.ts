// Apple Wallet Pass generation utilities for gift cards
// Note: Full Apple Wallet integration requires server-side pass signing
// This provides the client-side interface and fallback options

export interface GiftCardPassData {
  cardNumber: string;
  balance: number;
  recipientName?: string;
  purchaseDate: string;
  expirationDate: string;
}

// Generate a barcode-friendly card number (numeric only for Code128 compatibility)
export function generateBarcodeNumber(code: string): string {
  // Convert the alphanumeric code to a numeric representation
  // Take the code and generate a 16-digit number
  const hash = code.split('').reduce((acc, char, i) => {
    return acc + char.charCodeAt(0) * (i + 1);
  }, 0);

  const timestamp = Date.now().toString().slice(-10);
  const numericCode = `${hash.toString().padStart(6, '0')}${timestamp}`;
  return numericCode.slice(0, 16);
}

// Format card number for display (groups of 4)
export function formatCardNumberForDisplay(cardNumber: string): string {
  return cardNumber.match(/.{1,4}/g)?.join(' ') || cardNumber;
}

// Generate a simple barcode SVG (Code 128 style)
export function generateBarcodeSVG(data: string, width: number = 200, height: number = 60): string {
  // Simple barcode representation using the data
  const bars: string[] = [];
  const barWidth = width / (data.length * 11 + 35); // 11 modules per character + start/stop

  let x = barWidth * 10; // Start margin

  // Start pattern
  bars.push(`<rect x="${x}" width="${barWidth * 2}" height="${height}" fill="black"/>`);
  x += barWidth * 3;
  bars.push(`<rect x="${x}" width="${barWidth}" height="${height}" fill="black"/>`);
  x += barWidth * 2;
  bars.push(`<rect x="${x}" width="${barWidth * 2}" height="${height}" fill="black"/>`);
  x += barWidth * 4;

  // Data bars (simplified representation)
  for (const char of data) {
    const charCode = char.charCodeAt(0);
    const pattern = [
      charCode % 2 === 0,
      (charCode >> 1) % 2 === 0,
      (charCode >> 2) % 2 === 0,
      (charCode >> 3) % 2 === 0,
      (charCode >> 4) % 2 === 0,
      (charCode >> 5) % 2 === 0,
    ];

    for (const isBar of pattern) {
      if (isBar) {
        bars.push(`<rect x="${x}" width="${barWidth}" height="${height}" fill="black"/>`);
      }
      x += barWidth * 1.5;
    }
    x += barWidth;
  }

  // Stop pattern
  bars.push(`<rect x="${x}" width="${barWidth * 2}" height="${height}" fill="black"/>`);
  x += barWidth * 3;
  bars.push(`<rect x="${x}" width="${barWidth}" height="${height}" fill="black"/>`);
  x += barWidth * 2;
  bars.push(`<rect x="${x}" width="${barWidth}" height="${height}" fill="black"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height + 20}">
    <rect width="${width}" height="${height + 20}" fill="white"/>
    ${bars.join('\n    ')}
    <text x="${width / 2}" y="${height + 15}" text-anchor="middle" font-family="monospace" font-size="10" fill="black">
      ${formatCardNumberForDisplay(data)}
    </text>
  </svg>`;
}

// Generate Apple Wallet .pkpass manifest (would need server-side signing)
export function generatePassManifest(passData: GiftCardPassData): object {
  return {
    formatVersion: 1,
    passTypeIdentifier: 'pass.com.camarillobookworm.giftcard',
    serialNumber: passData.cardNumber,
    teamIdentifier: 'XXXXXXXXXX', // Would need Apple Developer Team ID
    organizationName: 'Camarillo Bookworm',
    description: 'Gift Card',
    logoText: 'Camarillo Bookworm',
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(27, 67, 50)', // Primary green
    storeCard: {
      headerFields: [
        {
          key: 'balance',
          label: 'BALANCE',
          value: passData.balance,
          currencyCode: 'USD',
        },
      ],
      primaryFields: [
        {
          key: 'cardNumber',
          label: 'CARD NUMBER',
          value: formatCardNumberForDisplay(passData.cardNumber),
        },
      ],
      secondaryFields: passData.recipientName
        ? [
            {
              key: 'recipient',
              label: 'FOR',
              value: passData.recipientName,
            },
          ]
        : [],
      auxiliaryFields: [
        {
          key: 'expires',
          label: 'EXPIRES',
          value: new Date(passData.expirationDate).toLocaleDateString(),
        },
      ],
      backFields: [
        {
          key: 'terms',
          label: 'Terms & Conditions',
          value:
            'This gift card is redeemable at Camarillo Bookworm for merchandise. Cannot be exchanged for cash. Protect this card like cash.',
        },
        {
          key: 'support',
          label: 'Questions?',
          value: 'Contact us at (805) 555-0123 or visit camarillobookworm.com',
        },
      ],
    },
    barcode: {
      message: passData.cardNumber,
      format: 'PKBarcodeFormatCode128',
      messageEncoding: 'iso-8859-1',
      altText: formatCardNumberForDisplay(passData.cardNumber),
    },
    barcodes: [
      {
        message: passData.cardNumber,
        format: 'PKBarcodeFormatCode128',
        messageEncoding: 'iso-8859-1',
        altText: formatCardNumberForDisplay(passData.cardNumber),
      },
    ],
  };
}

// Check if device supports Apple Wallet
export function supportsAppleWallet(): boolean {
  // Check for iOS Safari
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  return isIOS || isSafari;
}

// Request Apple Wallet pass from server
export async function requestAppleWalletPass(passData: GiftCardPassData): Promise<{
  success: boolean;
  passUrl?: string;
  error?: string;
}> {
  try {
    const response = await fetch('/api/apple-wallet-pass', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(passData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.message || 'Failed to generate Apple Wallet pass',
      };
    }

    // Check if response is a .pkpass file
    const contentType = response.headers.get('content-type');
    if (contentType === 'application/vnd.apple.pkpass') {
      // Download the pass directly
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.location.href = url; // This will trigger the "Add to Wallet" prompt on iOS
      return { success: true, passUrl: url };
    }

    // Otherwise, the server returned JSON (probably status/error)
    const data = await response.json();
    if (data.success) {
      return { success: true };
    }

    return {
      success: false,
      error: data.message || 'Apple Wallet pass generation pending',
    };
  } catch (error: any) {
    console.error('Apple Wallet pass request error:', error);
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

// Download pass as a file (fallback when Apple Wallet is not configured)
export function downloadPassPlaceholder(passData: GiftCardPassData): void {
  // Create a simple HTML card that can be saved
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Camarillo Bookworm Gift Card</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .card { max-width: 350px; margin: 0 auto; background: linear-gradient(135deg, #1B4332 0%, #2D5A4A 100%); border-radius: 16px; padding: 24px; color: white; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
    .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px; }
    .logo { font-size: 18px; font-weight: 600; }
    .balance-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; }
    .balance { font-size: 28px; font-weight: 700; }
    .barcode-container { background: white; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
    .barcode { width: 100%; height: 60px; }
    .card-number { font-family: monospace; font-size: 14px; color: #333; margin-top: 8px; letter-spacing: 2px; }
    .footer { display: flex; justify-content: space-between; font-size: 12px; opacity: 0.7; }
    .instructions { margin-top: 20px; background: white; border-radius: 8px; padding: 16px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">Camarillo Bookworm</div>
      <div style="text-align: right;">
        <div class="balance-label">Balance</div>
        <div class="balance">$${passData.balance.toFixed(2)}</div>
      </div>
    </div>
    ${passData.recipientName ? `<div style="margin-bottom: 16px; opacity: 0.8;">For: ${passData.recipientName}</div>` : ''}
    <div class="barcode-container">
      ${generateBarcodeSVG(passData.cardNumber, 280, 50)}
    </div>
    <div class="footer">
      <span>Purchased: ${new Date(passData.purchaseDate).toLocaleDateString()}</span>
      <span>Expires: ${new Date(passData.expirationDate).toLocaleDateString()}</span>
    </div>
  </div>
  <div class="instructions">
    <strong>How to use:</strong> Present this card at checkout in-store or enter the card number online.
    Save this page or screenshot for your records.
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bookworm-giftcard-${passData.cardNumber}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
