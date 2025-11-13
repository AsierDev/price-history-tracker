/**
 * Generic price parser utility
 * Extracts price information from arbitrary text
 */

import { logger } from './logger';
import { createDocument } from './htmlParser';

export interface ParsedPrice {
  price: number;
  currency: string;
  rawText: string;
}

/**
 * Parse price from arbitrary text containing currency symbols and numbers
 * Supports multiple formats:
 * - €1.299,99 or €1,299.99
 * - $29.99 or 29.99$
 * - 1299.99 USD
 * - £19.99 GBP
 */
export function parseGenericPrice(text: string): ParsedPrice | null {
  if (!text || typeof text !== 'string') {
    logger.warn('Invalid input for price parsing', { text });
    return null;
  }

  // Clean up text: remove extra whitespace and newlines
  const cleanText = text.trim().replace(/\s+/g, ' ');

  // Regex pattern to match various price formats
  // Group 1: Currency symbol before number (€, $, £, ¥)
  // Group 2: Number when currency is before
  // Group 3: Number when currency is after
  // Group 4: Currency symbol or code after number (€, $, £, ¥, EUR, USD, GBP, etc.)
  // Updated to handle numbers like 2999 (no separators) and prices with spaces like "$ 29 . 99"
  const pricePattern =
    /([€$£¥₹₽¢])\s*(\d{1,}(?:[.,\s]\d{1,})*)|(\d{1,}(?:[.,\s]\d{1,})*)\s*([€$£¥₹₽¢]|EUR|USD|GBP|JPY|CNY|INR|RUB|AUD|CAD|CHF|MXN|BRL)/gi;

  let bestMatch: ParsedPrice | null = null;
  let match: RegExpExecArray | null;

  // Find all price patterns in text
  while ((match = pricePattern.exec(cleanText)) !== null) {
    try {
      let currencySymbol: string;
      let numberString: string;

      if (match[1] && match[2]) {
        // Currency before number (€29.99)
        currencySymbol = match[1];
        numberString = match[2];
      } else if (match[3] && match[4]) {
        // Currency after number (29.99 USD)
        currencySymbol = match[4];
        numberString = match[3];
      } else {
        continue;
      }

      // Parse the number string
      const parsedNumber = parseNumberString(numberString);
      if (parsedNumber === null) {
        continue;
      }

      // Map currency symbol to ISO code
      const currency = mapCurrencySymbol(currencySymbol);

      const parsedPrice: ParsedPrice = {
        price: parsedNumber,
        currency,
        rawText: match[0],
      };

      // Keep the first valid match (usually the main price)
      if (!bestMatch) {
        bestMatch = parsedPrice;
      }

      logger.debug('Price parsed successfully', {
        price: parsedPrice.price,
        currency: parsedPrice.currency,
        rawText: parsedPrice.rawText,
      });
    } catch (error) {
      logger.warn('Failed to parse price match', { match: match[0], error });
      continue;
    }
  }

  if (!bestMatch) {
    logger.warn('No valid price found in text', { text: cleanText.substring(0, 100) });
    return null;
  }

  return bestMatch;
}

/**
 * Parse number string with various formats
 * Handles: 1.299,99 (EU) or 1,299.99 (US) or 1299.99 (simple)
 */
function parseNumberString(numStr: string): number | null {
  // Remove spaces
  numStr = numStr.replace(/\s/g, '');

  // Detect format by checking last separator
  const lastComma = numStr.lastIndexOf(',');
  const lastDot = numStr.lastIndexOf('.');

  let normalized: string;

  if (lastComma > lastDot) {
    // European format: 1.299,99
    // Remove dots (thousands separator) and replace comma with dot
    normalized = numStr.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // US format: 1,299.99
    // Remove commas (thousands separator)
    normalized = numStr.replace(/,/g, '');
  } else if (lastComma === -1 && lastDot === -1) {
    // No separators: 1299
    normalized = numStr;
  } else {
    // Ambiguous or invalid format
    // Try to parse as-is, removing commas
    normalized = numStr.replace(/,/g, '');
  }

  const parsed = parseFloat(normalized);

  if (isNaN(parsed) || parsed <= 0) {
    logger.warn('Invalid number after parsing', { original: numStr, normalized, parsed });
    return null;
  }

  return parsed;
}

/**
 * Map currency symbol/code to ISO 4217 currency code
 */
function mapCurrencySymbol(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();

  const currencyMap: Record<string, string> = {
    '€': 'EUR',
    '$': 'USD',
    '£': 'GBP',
    '¥': 'JPY',
    '₹': 'INR',
    '₽': 'RUB',
    '¢': 'USD', // Cents
    EUR: 'EUR',
    USD: 'USD',
    GBP: 'GBP',
    JPY: 'JPY',
    CNY: 'CNY',
    INR: 'INR',
    RUB: 'RUB',
    AUD: 'AUD',
    CAD: 'CAD',
    CHF: 'CHF',
    MXN: 'MXN',
    BRL: 'BRL',
  };

  return currencyMap[upperSymbol] || 'USD'; // Default to USD if unknown
}

/**
 * Validate that a text looks like it contains a price
 * Used before accepting user selection
 */
export function looksLikePrice(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const cleanText = text.trim();

  // Check for currency symbols
  const hasCurrencySymbol = /[€$£¥₹₽¢]|EUR|USD|GBP|JPY|CNY|INR|RUB|AUD|CAD|CHF|MXN|BRL/i.test(
    cleanText
  );

  // Check for number with optional thousands separator and decimal
  const hasNumber = /\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2,3})?/.test(cleanText);

  return hasCurrencySymbol && hasNumber;
}

/**
 * Extract price from HTML element using custom selector
 */
export function extractPriceFromHTML(html: string, selector: string): ParsedPrice | null {
  try {
    const doc = createDocument(html);

    const element = doc.querySelector(selector);
    if (!element) {
      logger.warn('Selector did not match any element', { selector });
      return null;
    }

    const text = element.textContent || '';
    return parseGenericPrice(text);
  } catch (error) {
    logger.error('Failed to extract price from HTML', { selector, error });
    return null;
  }
}
