import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EbayAdapter } from '@adapters/implementations/ebay.adapter';

vi.stubEnv('AFFILIATE_EBAY_ID', 'test-epn-id');

describe('EbayAdapter', () => {
  let adapter: EbayAdapter;

  beforeEach(() => {
    adapter = new EbayAdapter();
  });

  describe('Basic Properties', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('ebay');
    });

    it('should be enabled', () => {
      expect(adapter.enabled).toBe(true);
    });

    it('should have correct affiliate network ID', () => {
      expect(adapter.affiliateNetworkId).toBe('ebay-partner-network');
    });
  });

  describe('canHandle', () => {
    it('should handle eBay COM URLs', () => {
      expect(adapter.canHandle('https://ebay.com/itm/123456789')).toBe(true);
      expect(adapter.canHandle('https://www.ebay.com/itm/123456789')).toBe(true);
    });

    it('should handle eBay ES URLs', () => {
      expect(adapter.canHandle('https://ebay.es/itm/123456789')).toBe(true);
      expect(adapter.canHandle('https://www.ebay.es/itm/123456789')).toBe(true);
    });

    it('should handle other eBay domains', () => {
      expect(adapter.canHandle('https://ebay.co.uk/itm/123456789')).toBe(true);
      expect(adapter.canHandle('https://ebay.de/itm/123456789')).toBe(true);
    });

    it('should reject non-eBay URLs', () => {
      expect(adapter.canHandle('https://amazon.com/dp/123')).toBe(false);
      expect(adapter.canHandle('https://aliexpress.com/item/123')).toBe(false);
    });

    it('should reject eBay URLs without item paths', () => {
      expect(adapter.canHandle('https://ebay.com')).toBe(false);
      expect(adapter.canHandle('https://ebay.com/search')).toBe(false);
    });
  });

  describe('generateAffiliateUrl', () => {
    it('should generate affiliate URL', () => {
      const url = 'https://ebay.com/itm/123456789';
      const result = adapter.generateAffiliateUrl(url);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
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
