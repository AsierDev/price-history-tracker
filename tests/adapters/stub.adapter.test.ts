import { describe, expect, it } from 'vitest';
import { StubAdapter } from '@adapters/implementations/stub.adapter';

describe('StubAdapter', () => {
  const adapter = new StubAdapter({
    name: 'demo',
    affiliateNetworkId: 'demo-network',
    currency: 'USD',
    errorMessage: 'Demo adapter not implemented yet',
  });

  it('is disabled and cannot handle URLs', () => {
    expect(adapter.enabled).toBe(false);
    expect(adapter.canHandle('https://example.com')).toBe(false);
  });

  it('returns placeholder data with the configured message', async () => {
    const result = await adapter.extractData('<html></html>');
    expect(result.available).toBe(false);
    expect(result.currency).toBe('USD');
    expect(result.error).toBe('Demo adapter not implemented yet');
  });

  it('returns original URL when generating affiliate links', () => {
    const url = 'https://example.com/product';
    expect(adapter.generateAffiliateUrl(url)).toBe(url);
  });
});
