/**
 * AliExpress adapter - Full implementation
 * Supports: aliexpress.com, aliexpress.es, etc.
 */

import { BaseAdapter } from '../base/BaseAdapter';
import { looksLikePrice } from '../../utils/priceUtils';
import { ENV } from '../../config/env';

export class AliExpressAdapter extends BaseAdapter {
  name = 'aliexpress';
  affiliateNetworkId = 'admitad';
  enabled = true;
  urlPatterns = [
    /aliexpress\.[a-z.]+\/item\//i,
    /aliexpress\.[a-z.]+\/.*\.html/i,
  ];

  generateAffiliateUrl(url: string): string {
    const admitadId = ENV.AFFILIATE_ADMITAD_ID;
    if (admitadId) {
      return `https://admitad.com/g/${admitadId}/?ulp=${encodeURIComponent(url)}`;
    }
    return url;
  }

  protected extractTitle(doc: Document): string | null {
    const selectors = [
      'h1.product-title',
      '.product-title-text',
      'h1[data-pl="product-title"]',
      '.pdp-info-title',
    ];
    return this.extractTextBySelectors(doc, selectors);
  }

  protected extractPrice(doc: Document): { price: number; currency: string } | null {
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
        const priceData = this.parsePriceFromText(element.textContent.trim());
        if (priceData) return priceData;
      }
    }

    // If exact selectors fail, try to find any element containing price-like text
    const allElements = Array.from(doc.querySelectorAll('*'));
    for (const element of allElements) {
      const text = element.textContent?.trim();
      if (text && looksLikePrice(text)) {
        const priceData = this.parsePriceFromText(text);
        if (priceData) return priceData;
      }
    }

    return null;
  }

  protected extractImage(doc: Document): string | undefined {
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

  // AliExpress usually shows only available products - use default true
}
