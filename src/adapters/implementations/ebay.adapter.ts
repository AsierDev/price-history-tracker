/**
 * eBay adapter - Full implementation
 * Supports: ebay.com, ebay.es, ebay.co.uk, etc.
 */

import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';
import { logger } from '../../utils/logger';
import { createDocument } from '../../utils/htmlParser';
import { parsePrice, detectCurrency, isOutOfStock } from '../../utils/priceUtils';

export class EbayAdapter implements PriceAdapter {
  name = 'ebay';
  affiliateNetworkId = 'ebay-partner-network';
  enabled = true;
  urlPatterns = [
    /ebay\.[a-z.]+\/itm\//i,
    /ebay\.[a-z.]+\/p\//i,
  ];

  canHandle(url: string): boolean {
    return this.urlPatterns.some(pattern => pattern.test(url));
  }

  async extractData(html: string, _customSelector?: string): Promise<ExtractedProductData> {
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

      // Check availability
      const available = this.checkAvailability(doc);

      return {
        title,
        price: priceData.price,
        currency: priceData.currency,
        imageUrl,
        available,
      };
    } catch (error) {
      logger.error('eBay extraction failed', error);
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
    // eBay Partner Network integration (passthrough for MVP)
    // TODO: Implement full EPN URL generation with campaign ID
    const epnId = process.env.AFFILIATE_EBAY_ID;
    if (epnId) {
      // Future: Generate proper EPN URL
      // return `https://rover.ebay.com/rover/1/.../${epnId}?url=${encodeURIComponent(url)}`;
    }
    return url;
  }

  private extractTitle(doc: Document): string | null {
    const selectors = [
      'h1.it-ttl',
      'h1.x-item-title__mainTitle',
      '.x-item-title .ux-textspans',
      'h1[itemprop="name"]',
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
      '.x-price-primary span:not([class])',
      '.x-price-primary .ux-textspans',
      '[data-testid="x-price-primary"] span',
      '[data-testid="x-price-primary"]',
      '.vi-VR-cvipPrice',
      '[itemprop="price"]',
      '.display-price',
      '.notranslate',
      '.u-flL',
    ];

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

    return null;
  }

  private extractImage(doc: Document): string | undefined {
    const selectors = [
      '.vi_content img',
      '#icImg',
      '.ux-image-carousel-item img',
      '[data-testid="ux-image-carousel-item"] img',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector) as HTMLImageElement;
      if (element?.src && !element.src.includes('placeholder')) {
        return element.src;
      }
    }

    return undefined;
  }

  private checkAvailability(doc: Document): boolean {
    // Check for "Buy It Now" or "Add to cart" buttons with modern selectors
    const buyButtons = [
      '[data-testid="ux-action"]',
      '[data-testid="x-btn-buy-now"]',
      '[data-testid="ux-call-to-action"]',
      '.vi-VR-btn',
      '.u-flL .btn',
      '.u-flL .vi-VR-btn',
    ];

    const hasBuyButton = buyButtons.some(selector => doc.querySelector(selector) !== null);

    if (!hasBuyButton) return false;

    // Check for out of stock text in various places
    const availabilityTexts = [
      doc.querySelector('.vi-acc-del-range')?.textContent || '',
      doc.querySelector('.u-flL')?.textContent || '',
      doc.querySelector('.vi-bbox-dspn')?.textContent || '',
      doc.querySelector('[data-testid="ux-layout-section-module-evo"]')?.textContent || '',
    ];

    const combinedText = availabilityTexts.join(' ');
    return !isOutOfStock(combinedText);
  }

  private parsePrice(text: string): number {
    return parsePrice(text);
  }

  private detectCurrency(text: string): string {
    return detectCurrency(text);
  }
}
