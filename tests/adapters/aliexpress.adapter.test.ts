import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AliExpressAdapter } from '@adapters/implementations/aliexpress.adapter';

vi.stubEnv('AFFILIATE_ADMITAD_ID', 'test-admitad-id');

describe('AliExpressAdapter', () => {
  let adapter: AliExpressAdapter;

  beforeEach(() => {
    adapter = new AliExpressAdapter();
  });

  describe('Basic Properties', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('aliexpress');
    });

    it('should be enabled', () => {
      expect(adapter.enabled).toBe(true);
    });

    it('should have correct affiliate network ID', () => {
      expect(adapter.affiliateNetworkId).toBe('admitad');
    });
  });

  describe('canHandle', () => {
    it('should handle AliExpress COM URLs', () => {
      expect(adapter.canHandle('https://aliexpress.com/item/123456789.html')).toBe(true);
      expect(adapter.canHandle('https://www.aliexpress.com/item/123456789.html')).toBe(true);
    });

    it('should handle AliExpress ES URLs', () => {
      expect(adapter.canHandle('https://aliexpress.es/item/123456789.html')).toBe(true);
      expect(adapter.canHandle('https://www.aliexpress.es/item/123456789.html')).toBe(true);
    });

    it('should handle other AliExpress domains', () => {
      expect(adapter.canHandle('https://aliexpress.co.uk/item/123456789.html')).toBe(true);
      expect(adapter.canHandle('https://aliexpress.de/item/123456789.html')).toBe(true);
    });

    it('should reject non-AliExpress URLs', () => {
      expect(adapter.canHandle('https://amazon.com/dp/123')).toBe(false);
      expect(adapter.canHandle('https://ebay.com/itm/123')).toBe(false);
    });

    it('should reject AliExpress URLs without item paths', () => {
      expect(adapter.canHandle('https://aliexpress.com')).toBe(false);
      expect(adapter.canHandle('https://aliexpress.com/search')).toBe(false);
    });
  });

  describe('generateAffiliateUrl', () => {
    it('should generate affiliate URL', () => {
      const url = 'https://aliexpress.com/item/123456789.html';
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
