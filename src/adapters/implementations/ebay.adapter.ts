/**
 * eBay adapter - Full implementation
 * Supports: ebay.com, ebay.es, ebay.co.uk, etc.
 */

import { BaseAdapter } from '../base/BaseAdapter';
import { ENV } from '../../config/env';

export class EbayAdapter extends BaseAdapter {
  name = 'ebay';
  affiliateNetworkId = 'ebay-partner-network';
  enabled = true;
  urlPatterns = [
    /ebay\.[a-z.]+\/itm\//i,
    /ebay\.[a-z.]+\/p\//i,
  ];

  generateAffiliateUrl(url: string): string {
    // eBay Partner Network integration (passthrough for MVP)
    // TODO: Implement full EPN URL generation with campaign ID
    const epnId = ENV.AFFILIATE_EBAY_ID;
    if (epnId) {
      // Future: Generate proper EPN URL
      // return `https://rover.ebay.com/rover/1/.../${epnId}?url=${encodeURIComponent(url)}`;
    }
    return url;
  }

  protected extractTitle(doc: Document): string | null {
    const selectors = [
      'h1.it-ttl',
      'h1.x-item-title__mainTitle',
      '.x-item-title .ux-textspans',
      'h1[itemprop="name"]',
    ];
    return this.extractTextBySelectors(doc, selectors);
  }

  protected extractPrice(doc: Document): { price: number; currency: string } | null {
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
        const priceData = this.parsePriceFromText(element.textContent.trim());
        if (priceData) return priceData;
      }
    }
    return null;
  }

  protected extractImage(doc: Document): string | undefined {
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

  protected checkAvailability(doc: Document): boolean {
    // Check for "Buy It Now" or "Add to cart" buttons
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

    // Check for out of stock text
    const availabilityTexts = [
      doc.querySelector('.vi-acc-del-range')?.textContent || '',
      doc.querySelector('.u-flL')?.textContent || '',
      doc.querySelector('.vi-bbox-dspn')?.textContent || '',
      doc.querySelector('[data-testid="ux-layout-section-module-evo"]')?.textContent || '',
    ];

    const combinedText = availabilityTexts.join(' ');
    return !this.isOutOfStock(combinedText);
  }
}
