/**
 * Generic Adapter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GenericAdapter } from '../../src/adapters/implementations/generic.adapter';

describe('GenericAdapter', () => {
  let adapter: GenericAdapter;

  beforeEach(() => {
    adapter = new GenericAdapter();
  });

  describe('Basic properties', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('generic');
    });

    it('should be enabled', () => {
      expect(adapter.enabled).toBe(true);
    });

    it('should require manual selection', () => {
      expect(adapter.requiresManualSelection).toBe(true);
    });

    it('should match any URL (fallback)', () => {
      expect(adapter.canHandle('https://example.com')).toBe(true);
      expect(adapter.canHandle('https://random-shop.com/product/123')).toBe(true);
      expect(adapter.canHandle('https://etsy.com/listing/456')).toBe(true);
    });
  });

  describe('extractData', () => {
    it('should require custom selector', async () => {
      const html = '<html><body><div class="price">€29.99</div></body></html>';

      const result = await adapter.extractData(html);

      expect(result.available).toBe(false);
      expect(result.error).toContain('Manual selection required');
    });

    it('should extract price with custom selector', async () => {
      const html = `
        <html>
          <head><title>Great Product</title></head>
          <body>
            <div class="price-main">€29.99</div>
          </body>
        </html>
      `;

      const result = await adapter.extractData(html, '.price-main');

      expect(result.available).toBe(true);
      expect(result.price).toBe(29.99);
      expect(result.currency).toBe('EUR');
      expect(result.title).toBe('Great Product');
    });

    it('should handle US format prices', async () => {
      const html = `
        <html>
          <head><title>Product Page</title></head>
          <body>
            <span class="price">$1,299.99</span>
          </body>
        </html>
      `;

      const result = await adapter.extractData(html, '.price');

      expect(result.available).toBe(true);
      expect(result.price).toBe(1299.99);
      expect(result.currency).toBe('USD');
    });

    it('should handle EU format prices', async () => {
      const html = `
        <html>
          <head><title>Test</title></head>
          <body>
            <div class="price-box">1.299,99 €</div>
          </body>
        </html>
      `;

      const result = await adapter.extractData(html, '.price-box');

      expect(result.available).toBe(true);
      expect(result.price).toBe(1299.99);
      expect(result.currency).toBe('EUR');
    });

    it('should return error if selector not found', async () => {
      const html = `
        <html>
          <body>
            <div class="price">€29.99</div>
          </body>
        </html>
      `;

      const result = await adapter.extractData(html, '.nonexistent-selector');

      expect(result.available).toBe(false);
      expect(result.error).toContain('Price element not found');
    });

    it('should return error if price cannot be parsed', async () => {
      const html = `
        <html>
          <body>
            <div class="price">Not a price</div>
          </body>
        </html>
      `;

      const result = await adapter.extractData(html, '.price');

      expect(result.available).toBe(false);
      expect(result.error).toContain('Could not parse price');
    });

    it('should extract title from h1 if no title tag', async () => {
      const html = `
        <html>
          <body>
            <h1>Product from H1</h1>
            <div class="price">€19.99</div>
          </body>
        </html>
      `;

      const result = await adapter.extractData(html, '.price');

      expect(result.available).toBe(true);
      expect(result.title).toBe('Product from H1');
    });

    it('should use fallback title if no title or h1', async () => {
      const html = `
        <html>
          <body>
            <div class="price">€19.99</div>
          </body>
        </html>
      `;

      const result = await adapter.extractData(html, '.price');

      expect(result.available).toBe(true);
      // Fallback title now uses domain name
      expect(result.title).toContain('Product from');
    });

    it('should extract OG image', async () => {
      const html = `
        <html>
          <head>
            <title>Product</title>
            <meta property="og:image" content="https://example.com/image.jpg" />
          </head>
          <body>
            <div class="price">€19.99</div>
          </body>
        </html>
      `;

      const result = await adapter.extractData(html, '.price');

      expect(result.available).toBe(true);
      expect(result.imageUrl).toBe('https://example.com/image.jpg');
    });

    it('should handle multiple currency formats', async () => {
      const testCases = [
        { html: '<div class="p">$29.99</div>', expected: { price: 29.99, currency: 'USD' } },
        { html: '<div class="p">£19.99</div>', expected: { price: 19.99, currency: 'GBP' } },
        { html: '<div class="p">¥2999</div>', expected: { price: 2999, currency: 'JPY' } },
        { html: '<div class="p">29.99 EUR</div>', expected: { price: 29.99, currency: 'EUR' } },
      ];

      for (const testCase of testCases) {
        const html = `<html><head><title>Test</title></head><body>${testCase.html}</body></html>`;
        const result = await adapter.extractData(html, '.p');

        expect(result.available).toBe(true);
        expect(result.price).toBe(testCase.expected.price);
        expect(result.currency).toBe(testCase.expected.currency);
      }
    });
  });

  describe('generateAffiliateUrl', () => {
    it('should return original URL (no affiliate support)', () => {
      const url = 'https://example.com/product/123';
      expect(adapter.generateAffiliateUrl(url)).toBe(url);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty HTML', async () => {
      const result = await adapter.extractData('', '.price');

      expect(result.available).toBe(false);
    });

    it('should handle malformed HTML', async () => {
      const html = '<html><body><div class="price">€29.99';

      const result = await adapter.extractData(html, '.price');

      // DOMParser is lenient, should still work
      expect(result.available).toBe(true);
      expect(result.price).toBe(29.99);
    });

    it('should handle selector with special characters', async () => {
      const html = `
        <html>
          <head><title>Test</title></head>
          <body>
            <div data-test="price-box">€49.99</div>
          </body>
        </html>
      `;

      const result = await adapter.extractData(html, '[data-test="price-box"]');

      expect(result.available).toBe(true);
      expect(result.price).toBe(49.99);
    });

    it('should handle nested selectors', async () => {
      const html = `
        <html>
          <head><title>Test</title></head>
          <body>
            <div class="product">
              <div class="price">
                <span class="amount">€99.99</span>
              </div>
            </div>
          </body>
        </html>
      `;

      const result = await adapter.extractData(html, '.product .price .amount');

      expect(result.available).toBe(true);
      expect(result.price).toBe(99.99);
    });
  });
});
