/**
 * Belboon adapter - STUB (not implemented)
 * TODO: Implement when Belboon integration is ready
 */

import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';

export class BelboonAdapter implements PriceAdapter {
  name = 'belboon';
  affiliateNetworkId = 'belboon';
  enabled = false; // 🟡 STUB - Set to true when ready
  urlPatterns: RegExp[] = [];

  canHandle(_url: string): boolean {
    return false;
  }

  async extractData(_html: string, _customSelector?: string): Promise<ExtractedProductData> {
    return {
      title: 'Product',
      price: 0,
      currency: 'EUR',
      available: false,
      error: 'Belboon adapter not implemented yet',
    };
  }

  generateAffiliateUrl(url: string): string {
    // TODO: Implement Belboon URL generation
    // const apiKey = ENV.BELBOON_API_KEY;
    // return `https://partners.belboon.com/...?apiKey=${apiKey}&url=${encodeURIComponent(url)}`;
    return url;
  }
}
