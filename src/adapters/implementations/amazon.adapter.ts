/**
 * Amazon adapter - Full implementation
 * Supports: amazon.com, amazon.es, amazon.co.uk, etc.
 */

import { BaseAdapter } from '../base/BaseAdapter';
import { addQueryParam } from '../../utils/urlUtils';
import { ENV } from '../../config/env';

export class AmazonAdapter extends BaseAdapter {
  name = 'amazon';
  affiliateNetworkId = 'amazon-associates';
  enabled = true;
  urlPatterns = [
    /amazon\.[a-z.]+\/.*\/dp\//i,
    /amazon\.[a-z.]+\/dp\//i,
    /amazon\.[a-z.]+\/gp\/product\//i,
  ];

  generateAffiliateUrl(url: string): string {
    const affiliateTag = ENV.AFFILIATE_AMAZON_TAG || 'pricewatch-21';
    return addQueryParam(url, 'tag', affiliateTag);
  }

  protected extractTitle(doc: Document): string | null {
    const selectors = [
      '#productTitle',
      '#title',
      'h1.product-title',
      'h1 span#productTitle',
    ];
    return this.extractTextBySelectors(doc, selectors);
  }

  protected extractPrice(doc: Document): { price: number; currency: string } | null {
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
        const priceData = this.parsePriceFromText(element.textContent.trim());
        if (priceData) return priceData;
      }
    }
    return null;
  }

  protected extractImage(doc: Document): string | undefined {
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

  protected checkAvailability(doc: Document): boolean {
    const availabilityElement = doc.querySelector('#availability');
    if (!availabilityElement) return true;
    return !this.isOutOfStock(availabilityElement.textContent || '');
  }
}
