/**
 * Apple Wallet Pass Generator - Vercel Serverless Function
 *
 * This endpoint generates .pkpass files for gift cards that can be added to Apple Wallet.
 *
 * SETUP REQUIRED:
 * 1. Apple Developer Account ($99/year)
 * 2. Create a Pass Type ID in Apple Developer Portal
 * 3. Generate a Pass Type ID Certificate
 * 4. Export certificate as .p12 file
 * 5. Set environment variables in Vercel:
 *    - APPLE_PASS_TYPE_ID: Your pass type identifier (e.g., "pass.com.camarillobookworm.giftcard")
 *    - APPLE_TEAM_ID: Your Apple Developer Team ID
 *    - APPLE_PASS_CERTIFICATE: Base64-encoded .p12 certificate
 *    - APPLE_PASS_CERTIFICATE_PASSWORD: Password for the .p12 file
 *
 * Usage:
 * POST /api/apple-wallet-pass
 * Body: {
 *   cardNumber: string,
 *   balance: number,
 *   recipientName?: string,
 *   purchaseDate: string,
 *   expirationDate: string
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';

// Types
interface GiftCardPassRequest {
  cardNumber: string;
  balance: number;
  recipientName?: string;
  purchaseDate: string;
  expirationDate: string;
}

interface PassJson {
  formatVersion: number;
  passTypeIdentifier: string;
  serialNumber: string;
  teamIdentifier: string;
  organizationName: string;
  description: string;
  logoText: string;
  foregroundColor: string;
  backgroundColor: string;
  labelColor: string;
  barcode: {
    message: string;
    format: string;
    messageEncoding: string;
  };
  storeCard: {
    headerFields: Array<{ key: string; label: string; value: string }>;
    primaryFields: Array<{ key: string; label: string; value: string; currencyCode?: string }>;
    secondaryFields: Array<{ key: string; label: string; value: string }>;
    backFields: Array<{ key: string; label: string; value: string }>;
  };
}

// Environment variables (set in Vercel dashboard)
const PASS_TYPE_ID = process.env.APPLE_PASS_TYPE_ID || 'pass.com.camarillobookworm.giftcard';
const TEAM_ID = process.env.APPLE_TEAM_ID || '';
const CERTIFICATE_BASE64 = process.env.APPLE_PASS_CERTIFICATE || '';
const CERTIFICATE_PASSWORD = process.env.APPLE_PASS_CERTIFICATE_PASSWORD || '';

// Check if Apple Wallet is configured
function isConfigured(): boolean {
  return !!(TEAM_ID && CERTIFICATE_BASE64 && CERTIFICATE_PASSWORD);
}

// Generate pass.json content
function generatePassJson(data: GiftCardPassRequest): PassJson {
  const expirationDate = new Date(data.expirationDate);
  const formattedExpiry = expirationDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_ID,
    serialNumber: data.cardNumber,
    teamIdentifier: TEAM_ID,
    organizationName: 'Camarillo Bookworm',
    description: 'Camarillo Bookworm Gift Card',
    logoText: 'Camarillo Bookworm',
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(27, 67, 50)', // Forest green primary color
    labelColor: 'rgb(255, 255, 255)',
    barcode: {
      message: data.cardNumber,
      format: 'PKBarcodeFormatCode128',
      messageEncoding: 'iso-8859-1',
    },
    storeCard: {
      headerFields: [
        {
          key: 'balance',
          label: 'BALANCE',
          value: `$${data.balance.toFixed(2)}`,
        },
      ],
      primaryFields: [
        {
          key: 'cardNumber',
          label: 'CARD NUMBER',
          value: formatCardNumber(data.cardNumber),
        },
      ],
      secondaryFields: [
        ...(data.recipientName
          ? [{ key: 'recipient', label: 'FOR', value: data.recipientName }]
          : []),
        {
          key: 'expires',
          label: 'EXPIRES',
          value: formattedExpiry,
        },
      ],
      backFields: [
        {
          key: 'terms',
          label: 'Terms & Conditions',
          value:
            'This gift card is redeemable at Camarillo Bookworm for merchandise. ' +
            'Card has no cash value and cannot be exchanged for cash. ' +
            'Protect this card like cash. Lost or stolen cards will not be replaced. ' +
            'For balance inquiries, visit camarillobookworm.com or call (805) 555-BOOK.',
        },
        {
          key: 'store',
          label: 'Visit Us',
          value: 'Camarillo Bookworm\n123 Main Street\nCamarillo, CA 93010\n(805) 555-BOOK\ncamarillobookworm.com',
        },
      ],
    },
  };
}

// Format card number with spaces
function formatCardNumber(cardNumber: string): string {
  return cardNumber.replace(/(.{4})/g, '$1 ').trim();
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check configuration
  if (!isConfigured()) {
    return res.status(503).json({
      error: 'Apple Wallet not configured',
      message:
        'Apple Developer credentials are required. Please set APPLE_TEAM_ID, APPLE_PASS_CERTIFICATE, and APPLE_PASS_CERTIFICATE_PASSWORD environment variables.',
      setupInstructions: {
        step1: 'Create an Apple Developer account at developer.apple.com',
        step2: 'Register a Pass Type ID in Certificates, Identifiers & Profiles',
        step3: 'Generate and download a Pass Type ID Certificate',
        step4: 'Export certificate as .p12 and base64 encode it',
        step5: 'Set environment variables in Vercel dashboard',
      },
    });
  }

  try {
    const data: GiftCardPassRequest = req.body;

    // Validate required fields
    if (!data.cardNumber || typeof data.balance !== 'number') {
      return res.status(400).json({ error: 'Missing required fields: cardNumber, balance' });
    }

    // Generate pass.json
    const passJson = generatePassJson(data);

    // In a full implementation, you would:
    // 1. Create pass.json file
    // 2. Add icon.png, icon@2x.png, logo.png assets
    // 3. Generate manifest.json with SHA1 hashes of all files
    // 4. Sign the manifest with your Apple certificate
    // 5. Package everything into a .pkpass (ZIP) file
    // 6. Return with Content-Type: application/vnd.apple.pkpass

    // For now, we return the pass data structure
    // Full implementation requires the 'passkit-generator' or similar library

    // Placeholder response - in production, return the actual .pkpass file
    return res.status(200).json({
      success: true,
      message: 'Pass generation ready - certificate signing pending',
      passData: passJson,
      note: 'Full .pkpass generation requires passkit-generator library. Install with: npm install passkit-generator',
    });
  } catch (error: any) {
    console.error('Apple Wallet pass generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate pass',
      message: error.message,
    });
  }
}
