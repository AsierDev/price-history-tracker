import { describe, it, expect } from 'vitest';
import { parsePrice, detectCurrency, looksLikePrice } from '../utils/priceUtils';

describe('priceUtils', () => {
  describe('parsePrice', () => {
    it('should parse US format prices', () => {
      expect(parsePrice('$29.99')).toBe(29.99);
      expect(parsePrice('29.99')).toBe(29.99);
      expect(parsePrice('$1,299.99')).toBe(1299.99);
    });

    it('should parse European format prices', () => {
      expect(parsePrice('29,99€')).toBe(29.99);
      expect(parsePrice('1.299,99€')).toBe(1299.99);
    });

    it('should return 0 for invalid prices', () => {
      expect(parsePrice('not a price')).toBe(0);
      expect(parsePrice('')).toBe(0);
    });
  });

  describe('detectCurrency', () => {
    it('should detect EUR currency', () => {
      expect(detectCurrency('29,99€')).toBe('EUR');
      expect(detectCurrency('29.99 EUR')).toBe('EUR');
    });

    it('should detect USD currency', () => {
      expect(detectCurrency('$29.99')).toBe('USD');
      expect(detectCurrency('29.99 USD')).toBe('USD');
    });

    it('should default to EUR', () => {
      expect(detectCurrency('29.99')).toBe('EUR');
      expect(detectCurrency('no currency')).toBe('EUR');
    });
  });

  describe('looksLikePrice', () => {
    it('should identify price-like strings', () => {
      expect(looksLikePrice('$29.99')).toBe(true);
      expect(looksLikePrice('29,99€')).toBe(true);
      expect(looksLikePrice('29.99')).toBe(true);
    });

    it('should reject non-price strings', () => {
      expect(looksLikePrice('not a price')).toBe(false);
      expect(looksLikePrice('')).toBe(false);
    });
  });
});
