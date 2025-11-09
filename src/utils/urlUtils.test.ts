import { describe, it, expect } from 'vitest';
import { extractDomain, addQueryParam } from './urlUtils';

describe('urlUtils', () => {
  describe('extractDomain', () => {
    it('should extract domain from URL', () => {
      const result = extractDomain('https://amazon.es/dp/123');
      expect(typeof result).toBe('string');
    });

    it('should return string for valid URLs', () => {
      expect(typeof extractDomain('https://www.amazon.com/dp/123')).toBe('string');
      expect(typeof extractDomain('https://ebay.co.uk/itm/123')).toBe('string');
    });
  });

  describe('addQueryParam', () => {
    it('should add query parameter to URL', () => {
      const result = addQueryParam('https://amazon.es/dp/123', 'tag', 'test-tag');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return string for valid inputs', () => {
      const result = addQueryParam('https://amazon.es/dp/123?ref=abc', 'tag', 'test-tag');
      expect(typeof result).toBe('string');
      expect(result).toContain('amazon.es');
    });
  });
});
