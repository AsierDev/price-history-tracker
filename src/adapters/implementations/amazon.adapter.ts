/**
 * Amazon adapter - Full implementation
 * Supports: amazon.com, amazon.es, amazon.co.uk, etc.
 */

import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';
import { addQueryParam } from '../../utils/urlUtils';
import { logger } from '../../utils/logger';
import { createDocument } from '../../utils/htmlParser';
import { parsePrice, detectCurrency, isOutOfStock } from '../../utils/priceUtils';
import { ENV } from '../../config/env';

export class AmazonAdapter implements PriceAdapter {
  name = 'amazon';
  affiliateNetworkId = 'amazon-associates';
  enabled = true;
  urlPatterns = [
    /amazon\.[a-z.]+\/.*\/dp\//i,
    /amazon\.[a-z.]+\/dp\//i,
    /amazon\.[a-z.]+\/gp\/product\//i,
  ];

  canHandle(url: string): boolean {
    return this.urlPatterns.some(pattern => pattern.test(url));
  }

  async extractData(html: string, _customSelector?: string): Promise<ExtractedProductData> {
    try {
      const doc = createDocument(html);

      // Extract title (multiple selectors for reliability)
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
      logger.error('Amazon extraction failed', error);
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
    const affiliateTag = ENV.AFFILIATE_AMAZON_TAG || 'pricewatch-21';
    return addQueryParam(url, 'tag', affiliateTag);
  }

  private extractTitle(doc: Document): string | null {
    const selectors = [
      '#productTitle',
      '#title',
      'h1.product-title',
      'h1 span#productTitle',
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
      '.a-price-whole',
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price[data-a-color="price"] .a-offscreen',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        const text = element.textContent.trim();
        const price = parsePrice(text);
        if (price > 0) {
          const currency = detectCurrency(text);
          return { price, currency };
        }
      }
    }

    return null;
  }

  private extractImage(doc: Document): string | undefined {
    const selectors = [
      '#landingImage',
      '#imgBlkFront',
      '#main-image',
      '.a-dynamic-image',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector) as HTMLImageElement;
      if (element?.src) {
        return element.src;
      }
    }

    return undefined;
  }

  private checkAvailability(doc: Document): boolean {
    const availabilityElement = doc.querySelector('#availability');
    if (!availabilityElement) return true; // Assume available if not found

    const text = availabilityElement.textContent || '';
    return !isOutOfStock(text);
  }
}
