/**
 * AliExpress adapter - Full implementation
 * Supports: aliexpress.com, aliexpress.es, etc.
 */

import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';
import { logger } from '../../utils/logger';
import { createDocument } from '../../utils/htmlParser';
import { parsePrice, detectCurrency, looksLikePrice } from '../../utils/priceUtils';

export class AliExpressAdapter implements PriceAdapter {
  name = 'aliexpress';
  affiliateNetworkId = 'admitad';
  enabled = true;
  urlPatterns = [
    /aliexpress\.[a-z.]+\/item\//i,
    /aliexpress\.[a-z.]+\/.*\.html/i,
  ];

  canHandle(url: string): boolean {
    return this.urlPatterns.some(pattern => pattern.test(url));
  }

  async extractData(html: string): Promise<ExtractedProductData> {
    try {
      const doc = createDocument(html);

      // Extract title
      const title = this.extractTitle(doc);
      if (!title) {
        return {
          title: 'Product',
          price: 0,
          currency: 'EUR',
          available: false,
          error: 'Title not found',
        };
      }

      // Extract price
      const priceData = this.extractPrice(doc);
      if (!priceData) {
        return {
          title,
          price: 0,
          currency: 'EUR',
          available: false,
          error: 'Price not found',
        };
      }

      // Extract image
      const imageUrl = this.extractImage(doc);

      return {
        title,
        price: priceData.price,
        currency: priceData.currency,
        imageUrl,
        available: true, // AliExpress usually shows only available products
      };
    } catch (error) {
      logger.error('AliExpress extraction failed', error);
      return {
        title: 'Product',
        price: 0,
        currency: 'EUR',
        available: false,
        error: error instanceof Error ? error.message : 'Extraction failed',
      };
    }
  }

  generateAffiliateUrl(url: string): string {
    const admitadId = process.env.AFFILIATE_ADMITAD_ID;
    if (admitadId) {
      return `https://admitad.com/g/${admitadId}/?ulp=${encodeURIComponent(url)}`;
    }
    return url;
  }

  private extractTitle(doc: Document): string | null {
    const selectors = [
      'h1.product-title',
      '.product-title-text',
      'h1[data-pl="product-title"]',
      '.pdp-info-title',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  private extractPrice(doc: Document): { price: number; currency: string } | null {
    const selectors = [
      // Modern AliExpress selectors
      '.uniform-banner-box-price',
      '.pdp-price',
      '[data-pl="product-price"]',
      '.product-price-value',
      '.product-price-current',
      '[data-testid="price-value"]',
      '.price--currentPriceText--V8_y_b5',
      '.price--originalPriceText--V8_y_b5',
      '.price--priceText--V8_y_b5',
      '.price--discountPriceText--V8_y_b5',
      '.price-sale',
      '.price-origin',

      // Additional selectors for different layouts
      '.product-price-container .price',
      '.price-container .price-text',
      '.product-price-text',
      '.price-value',
      '.current-price',
      '.sale-price',

      // Spanish version specific
      '.precio-producto',
      '.precio-venta',
      '.precio-oferta',

      // Generic price containers
      '[class*="price"]',
      '[class*="Price"]',
    ];

    // First try exact selectors
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        const text = element.textContent.trim();
        const price = this.parsePrice(text);
        if (price > 0) {
          const currency = this.detectCurrency(text);
          return { price, currency };
        }
      }
    }

    // If exact selectors fail, try to find any element containing price-like text
    const allElements = Array.from(doc.querySelectorAll('*'));
    for (const element of allElements) {
      const text = element.textContent?.trim();
      if (text && this.looksLikePrice(text)) {
        const price = this.parsePrice(text);
        if (price > 0) {
          const currency = this.detectCurrency(text);
          return { price, currency };
        }
      }
    }

    return null;
  }

  private extractImage(doc: Document): string | undefined {
    const selectors = [
      '.magnifier-image',
      '.pdp-main-image',
      '[data-pl="product-image"]',
      '.images-view-item img',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector) as HTMLImageElement;
      if (element?.src) {
        return element.src;
      }
    }

    return undefined;
  }

  private parsePrice(text: string): number {
    return parsePrice(text);
  }

  private looksLikePrice(text: string): boolean {
    return looksLikePrice(text);
  }

  private detectCurrency(text: string): string {
    return detectCurrency(text);
  }
}
