import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AmazonAdapter } from '@adapters/implementations/amazon.adapter';

vi.stubEnv('AFFILIATE_AMAZON_TAG', 'pricewatch-test-21');

describe('AmazonAdapter', () => {
  let adapter: AmazonAdapter;

  beforeEach(() => {
    adapter = new AmazonAdapter();
  });

  describe('Basic Properties', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('amazon');
    });

    it('should be enabled', () => {
      expect(adapter.enabled).toBe(true);
    });

    it('should have correct affiliate network ID', () => {
      expect(adapter.affiliateNetworkId).toBe('amazon-associates');
    });
  });

  describe('canHandle', () => {
    it('should handle Amazon ES URLs', () => {
      expect(adapter.canHandle('https://amazon.es/dp/B06XGW29XJ')).toBe(true);
      expect(adapter.canHandle('https://www.amazon.es/dp/B06XGW29XJ')).toBe(true);
    });

    it('should handle Amazon COM URLs', () => {
      expect(adapter.canHandle('https://amazon.com/dp/B06XGW29XJ')).toBe(true);
      expect(adapter.canHandle('https://www.amazon.com/gp/product/B06XGW29XJ')).toBe(true);
    });

    it('should handle other Amazon domains', () => {
      expect(adapter.canHandle('https://amazon.co.uk/dp/B06XGW29XJ')).toBe(true);
      expect(adapter.canHandle('https://amazon.de/dp/B06XGW29XJ')).toBe(true);
    });

    it('should reject non-Amazon URLs', () => {
      expect(adapter.canHandle('https://ebay.com/itm/123')).toBe(false);
      expect(adapter.canHandle('https://aliexpress.com/item/123')).toBe(false);
      expect(adapter.canHandle('https://google.com')).toBe(false);
    });

    it('should reject Amazon URLs without product paths', () => {
      expect(adapter.canHandle('https://amazon.es')).toBe(false);
      expect(adapter.canHandle('https://amazon.com/search')).toBe(false);
    });
  });

  describe('generateAffiliateUrl', () => {
    it('should add affiliate tag to clean URL', () => {
      const url = 'https://amazon.es/dp/B06XGW29XJ';
      const result = adapter.generateAffiliateUrl(url);
      expect(result).toContain('amazon.es/dp/B06XGW29XJ');
      expect(result).toContain('tag=pricewatch-test-21');
    });

    it('should replace existing tag parameter', () => {
      const url = 'https://amazon.es/dp/B06XGW29XJ?tag=oldtag';
      const result = adapter.generateAffiliateUrl(url);
      expect(result).toContain('tag=pricewatch-test-21');
      expect(result).not.toContain('tag=oldtag');
    });

    it('should preserve other query parameters', () => {
      const url = 'https://amazon.es/dp/B06XGW29XJ?ref=abc&other=value';
      const result = adapter.generateAffiliateUrl(url);
      expect(result).toContain('ref=abc');
      expect(result).toContain('other=value');
      expect(result).toContain('tag=pricewatch-test-21');
    });

    it('should handle URLs with existing tag and other params', () => {
      const url = 'https://amazon.es/dp/B06XGW29XJ?tag=oldtag&ref=abc';
      const result = adapter.generateAffiliateUrl(url);
      expect(result).toContain('ref=abc');
      expect(result).toContain('tag=pricewatch-test-21');
      expect(result).not.toContain('tag=oldtag');
    });
  });

  describe('extractData', () => {
    it('should return error for invalid HTML', async () => {
      const result = await adapter.extractData('not html');
      expect(result.available).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for empty HTML', async () => {
      const result = await adapter.extractData('');
      expect(result.available).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
