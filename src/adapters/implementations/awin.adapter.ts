/**
 * AWIN adapter - STUB (not implemented)
 * TODO: Implement when AWIN integration is ready
 */

import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';

export class AwinAdapter implements PriceAdapter {
  name = 'awin';
  affiliateNetworkId = 'awin';
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
      error: 'AWIN adapter not implemented yet',
    };
  }

  generateAffiliateUrl(url: string): string {
    // TODO: Implement AWIN URL generation
    // const publisherId = process.env.AWIN_PUBLISHER_ID;
    // return `https://www.awin1.com/cread.php?awinmid=...&awinaffid=${publisherId}&clickref=...&p=${encodeURIComponent(url)}`;
    return url;
  }
}
