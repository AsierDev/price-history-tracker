/**
 * TradeTracker adapter - STUB (not implemented)
 * TODO: Implement when TradeTracker integration is ready
 */

import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';

export class TradeTrackerAdapter implements PriceAdapter {
  name = 'tradetracker';
  affiliateNetworkId = 'tradetracker';
  enabled = false; // 🟡 STUB - Set to true when ready
  urlPatterns: RegExp[] = [];

  canHandle(_url: string): boolean {
    return false;
  }

  async extractData(_html: string): Promise<ExtractedProductData> {
    return {
      title: 'Product',
      price: 0,
      currency: 'EUR',
      available: false,
      error: 'TradeTracker adapter not implemented yet',
    };
  }

  generateAffiliateUrl(url: string): string {
    // TODO: Implement TradeTracker URL generation
    // const clientId = process.env.TRADETRACKER_CLIENT_ID;
    // return `https://tc.tradetracker.net/?c=${clientId}&m=...&a=...&u=${encodeURIComponent(url)}`;
    return url;
  }
}
