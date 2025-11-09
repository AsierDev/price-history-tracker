/**
 * Price utilities for parsing and formatting prices across adapters
 */

export function parsePrice(text: string): number {
  // Remove currency symbols and spaces
  let cleaned = text
    .replace(/[€$£¥]/g, '')
    .replace(/\s/g, '');

  // Determine format: European uses comma as decimal separator
  // European format: "1.234,56" (comma is decimal, dots are thousands)
  // US format: "1,234.56" (dot is decimal, commas are thousands)
  const lastCommaIndex = cleaned.lastIndexOf(',');
  const lastDotIndex = cleaned.lastIndexOf('.');

  if (lastCommaIndex > lastDotIndex && lastCommaIndex > cleaned.length - 4) {
    // European format: comma is likely decimal separator (close to end)
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // US format: remove commas (thousands separators), keep dots as decimals
    cleaned = cleaned.replace(/,/g, '');
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
