/**
 * Base adapter with template method pattern
 * Eliminates code duplication across adapter implementations
 */

import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';
import { logger } from '../../utils/logger';
import { createDocument } from '../../utils/htmlParser';
import { parsePrice, detectCurrency, isOutOfStock } from '../../utils/priceUtils';

/**
 * Abstract base class for all price adapters
 * Implements common extraction logic and error handling
 */
export abstract class BaseAdapter implements PriceAdapter {
  abstract name: string;
  abstract affiliateNetworkId: string;
  abstract enabled: boolean;
  abstract urlPatterns: RegExp[];

  /**
   * Check if this adapter can handle the given URL
   */
  canHandle(url: string): boolean {
    return this.urlPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Template method for data extraction
   * Common flow with site-specific extraction delegated to subclasses
   */
  async extractData(html: string, customSelector?: string): Promise<ExtractedProductData> {
    try {
      const doc = createDocument(html);

      // Extract title (site-specific)
      const title = this.extractTitle(doc);
      if (!title) {
        return this.createErrorResponse('Title not found');
      }

      // Extract price (site-specific)
      const priceData = this.extractPrice(doc, customSelector);
      if (!priceData) {
        return this.createErrorResponse('Price not found', title);
      }

      // Extract image (site-specific, optional)
      const imageUrl = this.extractImage(doc);

      // Check availability (site-specific, optional)
      const available = this.checkAvailability(doc);

      return {
        title,
        price: priceData.price,
        currency: priceData.currency,
        imageUrl,
        available,
      };
    } catch (error) {
      logger.error(`${this.name} extraction failed`, {
        error,
        adapter: this.name,
        timestamp: Date.now(),
      });
      return this.createErrorResponse(
        error instanceof Error ? error.message : 'Extraction failed'
      );
    }
  }

  /**
   * Generate affiliate URL (default passthrough, override in subclasses)
   */
  generateAffiliateUrl(url: string): string {
    return url;
  }

  /**
   * Extract product title from document
   * Must be implemented by subclasses
   */
  protected abstract extractTitle(doc: Document): string | null;

  /**
   * Extract price and currency from document
   * Must be implemented by subclasses
   */
  protected abstract extractPrice(
    doc: Document,
    customSelector?: string
  ): { price: number; currency: string } | null;

  /**
   * Extract product image from document
   * Optional - returns undefined by default
   */
  protected extractImage(_doc: Document): string | undefined {
    // Default: no image extraction
    // Subclasses can override
    return undefined;
  }

  /**
   * Check product availability
   * Optional - returns true by default (assume available)
   */
  protected checkAvailability(_doc: Document): boolean {
    // Default: assume available
    // Subclasses can override
    return true;
  }

  /**
   * Helper: Try multiple selectors and return first match
   */
  protected findElementBySelectors(
    doc: Document,
    selectors: string[]
  ): Element | null {
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        return element;
      }
    }
    return null;
  }

  /**
   * Helper: Extract text from element using multiple selectors
   */
  protected extractTextBySelectors(
    doc: Document,
    selectors: string[]
  ): string | null {
    const element = this.findElementBySelectors(doc, selectors);
    return element?.textContent?.trim() || null;
  }

  /**
   * Helper: Parse price from text using utility functions
   */
  protected parsePriceFromText(
    text: string
  ): { price: number; currency: string } | null {
    const price = parsePrice(text);
    if (price > 0) {
      const currency = detectCurrency(text);
      return { price, currency };
    }
    return null;
  }

  /**
   * Helper: Check if text indicates out of stock
   */
  protected isOutOfStock(text: string): boolean {
    return isOutOfStock(text);
  }

  /**
   * Create standardized error response
   */
  private createErrorResponse(
    error: string,
    title: string = 'Product'
  ): ExtractedProductData {
    return {
      title,
      price: 0,
      currency: 'EUR',
      available: false,
      error,
    };
  }
}
