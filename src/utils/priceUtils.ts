/**
 * Price utilities for parsing and formatting prices across adapters
 */

export function parsePrice(text: string): number {
  // Handle European format (comma as decimal separator)
  let cleaned = text
    .replace(/[€$£¥]/g, '')
    .replace(/\s/g, '');

  // Check if it uses comma as decimal separator (European format)
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    // Single comma likely means European decimal (e.g., "55,67")
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = parts[0] + '.' + parts[1];
    }
  } else if (cleaned.includes(',') && cleaned.includes('.')) {
    // Both comma and dot - remove commas that are likely thousands separators
    cleaned = cleaned.replace(/,/g, '');
  } else {
    // US format - replace comma with dot for decimal
    cleaned = cleaned.replace(/,/g, '.');
  }

  const match = cleaned.match(/\d+\.?\d*/);
  return match ? parseFloat(match[0]) : 0;
}

export function detectCurrency(text: string): string {
  if (text.includes('€') || text.includes('EUR')) return 'EUR';
  if (text.includes('$') || text.includes('USD')) return 'USD';
  if (text.includes('£') || text.includes('GBP')) return 'GBP';
  if (text.includes('¥') || text.includes('JPY')) return 'JPY';
  return 'EUR'; // Default
}

export function looksLikePrice(text: string): boolean {
  // Check if text contains currency symbols or price-like patterns
  const pricePatterns = [
    /[€$£¥]\s*\d/,  // Currency symbol followed by digits
    /\d+\s*[€$£¥]/,  // Digits followed by currency symbol
    /\d+[,]\d{1,2}/,  // Decimal numbers like 55,67 (European format)
    /\d{1,3}([,.]\d{3})*[,]\d{2}/,  // Numbers with thousands separators (European)
    /\d+\.\d{1,2}/,  // Decimal numbers like 55.67 (US format)
  ];

  return pricePatterns.some(pattern => pattern.test(text));
}

export function isOutOfStock(text: string): boolean {
  const lowerText = text.toLowerCase();

  const outOfStockKeywords = [
    'no disponible',
    'out of stock',
    'agotado',
    'not available',
    'sold out',
    'no hay stock',
    'temporarily unavailable',
    'currently unavailable',
  ];

  return outOfStockKeywords.some(keyword => lowerText.includes(keyword));
}
