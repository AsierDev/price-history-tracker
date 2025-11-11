/**
 * Price Parser Utility Tests
 */

import { describe, it, expect } from 'vitest';
import { parseGenericPrice, looksLikePrice } from '../../src/utils/priceParser';

describe('parseGenericPrice', () => {
  describe('US format (comma as thousands separator)', () => {
    it('should parse $29.99', () => {
      const result = parseGenericPrice('$29.99');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(29.99);
      expect(result?.currency).toBe('USD');
    });

    it('should parse $1,299.99', () => {
      const result = parseGenericPrice('$1,299.99');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(1299.99);
      expect(result?.currency).toBe('USD');
    });

    it('should parse 29.99$', () => {
      const result = parseGenericPrice('29.99$');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(29.99);
      expect(result?.currency).toBe('USD');
    });

    it('should parse 1,299.99 USD', () => {
      const result = parseGenericPrice('1,299.99 USD');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(1299.99);
      expect(result?.currency).toBe('USD');
    });
  });

  describe('EU format (dot as thousands separator)', () => {
    it('should parse €29,99', () => {
      const result = parseGenericPrice('€29,99');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(29.99);
      expect(result?.currency).toBe('EUR');
    });

    it('should parse €1.299,99', () => {
      const result = parseGenericPrice('€1.299,99');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(1299.99);
      expect(result?.currency).toBe('EUR');
    });

    it('should parse 29,99€', () => {
      const result = parseGenericPrice('29,99€');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(29.99);
      expect(result?.currency).toBe('EUR');
    });

    it('should parse 1.299,99 EUR', () => {
      const result = parseGenericPrice('1.299,99 EUR');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(1299.99);
      expect(result?.currency).toBe('EUR');
    });
  });

  describe('Other currencies', () => {
    it('should parse £19.99 (GBP)', () => {
      const result = parseGenericPrice('£19.99');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(19.99);
      expect(result?.currency).toBe('GBP');
    });

    it('should parse ¥2999 (JPY)', () => {
      const result = parseGenericPrice('¥2999');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(2999);
      expect(result?.currency).toBe('JPY');
    });

    it('should parse 99.99 CAD', () => {
      const result = parseGenericPrice('99.99 CAD');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(99.99);
      expect(result?.currency).toBe('CAD');
    });

    it('should parse 149.99 AUD', () => {
      const result = parseGenericPrice('149.99 AUD');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(149.99);
      expect(result?.currency).toBe('AUD');
    });
  });

  describe('With extra text and whitespace', () => {
    it('should parse "Price: $29.99"', () => {
      const result = parseGenericPrice('Price: $29.99');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(29.99);
    });

    it('should parse "  €  29,99  "', () => {
      const result = parseGenericPrice('  €  29,99  ');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(29.99);
    });

    it('should parse multiline text with price', () => {
      const result = parseGenericPrice(`
        Product Name
        Description here
        $49.99
        More text
      `);
      expect(result).not.toBeNull();
      expect(result?.price).toBe(49.99);
    });

    it('should parse text with multiple prices (returns first)', () => {
      const result = parseGenericPrice('Was $99.99 Now $79.99');
      expect(result).not.toBeNull();
      // Should return first price found
      expect(result?.price).toBe(99.99);
    });
  });

  describe('Edge cases', () => {
    it('should return null for invalid input', () => {
      expect(parseGenericPrice('')).toBeNull();
      expect(parseGenericPrice('No price here')).toBeNull();
      expect(parseGenericPrice('123')).toBeNull(); // No currency
    });

    it('should return null for null/undefined', () => {
      expect(parseGenericPrice(null as unknown as string)).toBeNull();
      expect(parseGenericPrice(undefined as unknown as string)).toBeNull();
    });

    it('should handle zero price', () => {
      const result = parseGenericPrice('€0.00');
      // Zero is considered invalid
      expect(result).toBeNull();
    });

    it('should handle negative price', () => {
      const result = parseGenericPrice('€-10.00');
      // Negative is considered invalid
      expect(result).toBeNull();
    });

    it('should handle very large numbers', () => {
      const result = parseGenericPrice('$999,999.99');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(999999.99);
    });

    it('should handle three decimal places', () => {
      const result = parseGenericPrice('$29.999');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(29.999);
    });
  });

  describe('Real-world examples', () => {
    it('should parse Amazon-style price with extra space', () => {
      const result = parseGenericPrice('$ 29.99');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(29.99);
    });

    it('should parse eBay-style price', () => {
      const result = parseGenericPrice('US $149.99');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(149.99);
    });

    it('should parse Etsy-style price', () => {
      const result = parseGenericPrice('€19.95 EUR');
      expect(result).not.toBeNull();
      expect(result?.price).toBe(19.95);
      expect(result?.currency).toBe('EUR');
    });

    it('should parse AliExpress-style price', () => {
      const result = parseGenericPrice('US $12.99 - $29.99');
      expect(result).not.toBeNull();
      // Should return first price
      expect(result?.price).toBe(12.99);
    });
  });
});

describe('looksLikePrice', () => {
  it('should return true for valid price strings', () => {
    expect(looksLikePrice('$29.99')).toBe(true);
    expect(looksLikePrice('€29,99')).toBe(true);
    expect(looksLikePrice('£19.99')).toBe(true);
    expect(looksLikePrice('29.99 USD')).toBe(true);
    expect(looksLikePrice('Price: $49.99')).toBe(true);
  });

  it('should return false for invalid price strings', () => {
    expect(looksLikePrice('No price here')).toBe(false);
    expect(looksLikePrice('123')).toBe(false);
    expect(looksLikePrice('Just text')).toBe(false);
    expect(looksLikePrice('')).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(looksLikePrice(null as unknown as string)).toBe(false);
    expect(looksLikePrice(undefined as unknown as string)).toBe(false);
  });

  it('should handle whitespace', () => {
    expect(looksLikePrice('  $29.99  ')).toBe(true);
    expect(looksLikePrice('   ')).toBe(false);
  });
});
