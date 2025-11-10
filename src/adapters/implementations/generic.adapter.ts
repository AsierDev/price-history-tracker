/**
 * Generic Adapter - Universal price tracker with manual selection
 * Fallback adapter for any website not covered by specific adapters
 */

import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';
import { logger } from '../../utils/logger';
import { parseGenericPrice } from '../../utils/priceParser';
import { extractTitle, extractImage } from '../../utils/metadataExtractor';

export class GenericAdapter implements PriceAdapter {
  name = 'generic';
  affiliateNetworkId = 'none';
  enabled = true;
  urlPatterns: RegExp[] = [/.*/]; // Matches everything (fallback)
  requiresManualSelection = true; // User must select price element

  /**
   * Generic adapter can handle any URL (it's the fallback)
   */
  canHandle(_url: string): boolean {
    // Always return true - this is the universal fallback
    return true;
  }

  /**
   * Extract product data using custom selector
   * Requires customSelector parameter since user must manually select price element
   */
  async extractData(html: string, customSelector?: string): Promise<ExtractedProductData> {
    try {
      // If no custom selector provided, user needs to select manually
      if (!customSelector) {
        logger.warn('Generic adapter requires manual price selection');
        return {
          title: '',
          price: 0,
          currency: 'USD',
          available: false,
          error: 'Manual selection required. Please use the price picker to select the price element.',
        };
      }

      // Parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract price using custom selector
      const priceElement = doc.querySelector(customSelector);
      if (!priceElement) {
        logger.warn('Custom selector did not match any element', { selector: customSelector });
        return {
          title: '',
          price: 0,
          currency: 'USD',
          available: false,
          error: 'Price element not found. The website structure may have changed. Please re-select the price.',
        };
      }

      // Parse price from element text
      const priceText = priceElement.textContent || '';
      const parsedPrice = parseGenericPrice(priceText);

      if (!parsedPrice) {
        logger.warn('Could not parse price from selected element', {
          selector: customSelector,
          text: priceText.substring(0, 100),
        });
        return {
          title: '',
          price: 0,
          currency: 'USD',
          available: false,
          error: 'Could not parse price. Please ensure you selected the correct price element.',
        };
      }

      // Extract title from page using smart extractor
      const title = extractTitle(doc);

      // Try to extract image (optional, best effort) - pass price element for context
      const imageUrl = extractImage(doc, priceElement as HTMLElement);

      logger.info('Generic adapter extracted product data', {
        title,
        price: parsedPrice.price,
        currency: parsedPrice.currency,
        hasImage: !!imageUrl,
      });

      return {
        title,
        price: parsedPrice.price,
        currency: parsedPrice.currency,
        imageUrl,
        available: true,
      };
    } catch (error) {
      logger.error('Generic adapter extraction failed', { error, selector: customSelector });
      return {
        title: '',
        price: 0,
        currency: 'USD',
        available: false,
        error: 'Failed to extract product data. Please try again.',
      };
    }
  }

  /**
   * Generic adapter doesn't support affiliate URLs
   */
  generateAffiliateUrl(url: string): string {
    // No affiliate program for generic websites
    return url;
  }
}

// Export singleton instance
export const genericAdapter = new GenericAdapter();
