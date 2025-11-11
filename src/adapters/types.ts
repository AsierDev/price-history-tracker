/**
 * Adapter interface for price extraction from e-commerce sites
 */

import type { ExtractedProductData } from '../core/types';

export interface PriceAdapter {
  name: string;
  affiliateNetworkId: string;
  enabled: boolean;
  urlPatterns: RegExp[];
  requiresManualSelection?: boolean; // True for generic adapter
  
  /**
   * Check if this adapter can handle the given URL
   */
  canHandle(url: string): boolean;
  
  /**
   * Extract product data from HTML
   * @param html - HTML content to parse
   * @param customSelector - Optional CSS selector for generic adapter
   */
  extractData(html: string, customSelector?: string): Promise<ExtractedProductData>;
  
  /**
   * Generate affiliate URL from product URL
   */
  generateAffiliateUrl(url: string): string;
}
