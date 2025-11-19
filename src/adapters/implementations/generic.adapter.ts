/**
 * Generic Adapter - Universal price tracker with manual selection
 * Fallback adapter for any website not covered by specific adapters
 */

import { BaseAdapter } from '../base/BaseAdapter';
import { logger } from '../../utils/logger';
import { parseGenericPrice } from '../../utils/priceParser';
import { extractTitle, extractImage } from '../../utils/metadataExtractor';

export class GenericAdapter extends BaseAdapter {
  name = 'generic';
  affiliateNetworkId = 'none';
  enabled = true;
  urlPatterns: RegExp[] = [/.*/]; // Matches everything (fallback)
  requiresManualSelection = true; // User must select price element

  /**
   * Extract product title using generic extractor
   */
  protected extractTitle(doc: Document): string | null {
    return extractTitle(doc);
  }

  /**
   * Extract price using custom selector
   * Throws error if selector is missing (handled by BaseAdapter)
   */
  protected extractPrice(
    doc: Document,
    customSelector?: string
  ): { price: number; currency: string } | null {
    // If no custom selector provided, user needs to select manually
    if (!customSelector) {
      logger.warn('Generic adapter requires manual price selection');
      throw new Error(
        'Manual selection required. Please use the price picker to select the price element.'
      );
    }

    // Extract price using custom selector
    const priceElement = doc.querySelector(customSelector);
    if (!priceElement) {
      logger.warn('Custom selector did not match any element', { selector: customSelector });
      throw new Error(
        'Price element not found. The website structure may have changed. Please re-select the price.'
      );
    }

    // Parse price from element text
    const priceText = priceElement.textContent || '';
    const parsedPrice = parseGenericPrice(priceText);

    if (!parsedPrice) {
      logger.warn('Could not parse price from selected element', {
        selector: customSelector,
        text: priceText.substring(0, 100),
      });
      throw new Error(
        'Could not parse price. Please ensure you selected the correct price element.'
      );
    }

    return parsedPrice;
  }

  /**
   * Extract image using generic extractor
   * Overrides BaseAdapter to pass price element context if possible
   * Note: BaseAdapter's extractImage signature doesn't accept context element easily
   * without changing the interface. We'll use the document-level extractor.
   */
  protected extractImage(doc: Document): string | undefined {
    // In the original, we passed priceElement to extractImage.
    // Here we don't have easy access to priceElement unless we re-query it.
    // Given extractImage is best-effort, using doc is acceptable, 
    // or we can re-query if we really want to be precise.
    return extractImage(doc);
  }
}

// Export singleton instance
export const genericAdapter = new GenericAdapter();
