/**
 * Adapter interface for price extraction from e-commerce sites
 */

import type { ExtractedProductData } from '../core/types';

export interface PriceAdapter {
  name: string;
  affiliateNetworkId: string;
  enabled: boolean;
  urlPatterns: RegExp[];
  
  /**
   * Check if this adapter can handle the given URL
   */
  canHandle(url: string): boolean;
  
  /**
   * Extract product data from HTML
   */
  extractData(html: string): Promise<ExtractedProductData>;
  
  /**
   * Generate affiliate URL from product URL
   */
  generateAffiliateUrl(url: string): string;
}
