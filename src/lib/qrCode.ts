// ==============================================================================
// MAHAKU CORPORATION PVT. LTD. - STUDENT SAFETY TRACKING SYSTEM
// QR Code Generator & Secure Opaque Token Engine
// ==============================================================================

import QRCode from 'qrcode';

/**
 * Generates a collision-resistant random opaque token for student verification.
 * Does NOT contain student private PII.
 * Format: "mhk_sec_<random-hex-32>"
 */
export function generateStudentQrToken(): string {
  const randomArray = new Uint8Array(16);
  crypto.getRandomValues(randomArray);
  const randomHex = Array.from(randomArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `mhk_sec_${randomHex}`;
}

/**
 * Renders a high-resolution QR code data URL from an opaque token.
 * Uses Error Correction 'M' (15%) to ensure scan reliability on printed cards.
 */
export async function generateQrDataUrl(token: string): Promise<string> {
  try {
    return await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: {
        dark: '#0f172a', // Deep slate for sharp contrast
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR code data URL:', err);
    throw new Error('QR code generation failed.');
  }
}
