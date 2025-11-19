/**
 * Enhanced Generic Adapter - Smart auto-detection for whitelist sites
 * Implements cascading extraction with 70-80% success rate
 */



import { BaseAdapter } from '../base/BaseAdapter';
import type { ExtractedProductData } from '../../core/types';
import type { SupportedSite } from '../../config/supportedSites';
import { logger } from '../../utils/logger';
import { createDocument } from '../../utils/htmlParser';
import { parsePrice, detectCurrency } from '../../utils/priceUtils';
import { extractTitle, extractImage } from '../../utils/metadataExtractor';

type JsonObject = Record<string, unknown>;
type PriceCandidate = {
  price: number;
  currency: string;
  element: HTMLElement;
  score: number;
};

export class EnhancedGenericAdapter extends BaseAdapter {
  name = 'enhanced-generic';
  affiliateNetworkId = 'none';
  enabled = true;
  urlPatterns: RegExp[] = [/.*/]; // Matches everything (used for whitelist sites)
  requiresManualSelection = false; // Auto-detection enabled

  constructor(private siteInfo?: SupportedSite) {
    super();
  }

  /**
   * Implement abstract method from BaseAdapter
   * In this adapter, we usually extract everything in extractData,
   * but this provides a fallback for individual field extraction.
   */
  protected extractTitle(doc: Document): string | null {
    return extractTitle(doc);
  }

  /**
   * Implement abstract method from BaseAdapter
   * This adapter uses a cascading approach in extractData, so this is a simplified fallback
   * or used if BaseAdapter's extractData were called directly (which we override).
   */
  protected extractPrice(
    doc: Document,
    customSelector?: string
  ): { price: number; currency: string } | null {
    // If we have a custom selector, try that first
    if (customSelector) {
      const element = doc.querySelector(customSelector);
      if (element?.textContent) {
        const price = parsePrice(element.textContent);
        if (price > 0) {
          return {
            price,
            currency: detectCurrency(element.textContent) || 'EUR'
          };
        }
      }
    }
    return null;
  }

  /**
   * Extract product data using cascading auto-detection
   * Tries multiple methods in order of reliability
   * Overrides BaseAdapter.extractData because of the unique cascading flow
   */
  async extractData(html: string, customSelector?: string): Promise<ExtractedProductData> {
    try {
      const doc = createDocument(html);

      // If custom selector provided, use it directly (for already tracked products)
      if (customSelector) {
        return this.extractWithCustomSelector(doc, customSelector);
      }

      // Start cascading auto-extraction
      logger.info('Starting auto-extraction cascade for enhanced adapter', {
        siteName: this.siteInfo?.name || 'Unknown'
      });

      // Method 1: JSON-LD structured data (highest reliability)
      let result = await this.tryJsonLdExtraction(doc);
      if (result) {
        logger.info('✓ JSON-LD extraction successful', { title: result.title });
        return result;
      }
      logger.info('✗ JSON-LD extraction failed');

      // Method 2: Meta tags (Open Graph, Twitter Card)
      result = await this.tryMetaTagsExtraction(doc);
      if (result) {
        logger.info('✓ Meta tags extraction successful', { title: result.title });
        return result;
      }
      logger.info('✗ Meta tags extraction failed');

      // Method 3: Platform-specific selectors (Shopify, PrestaShop, etc.)
      result = await this.tryPlatformSelectorsExtraction(doc);
      if (result) {
        logger.info('✓ Platform selectors extraction successful', { title: result.title });
        return result;
      }
      logger.info('✗ Platform selectors extraction failed');

      // Method 4: Generic CSS patterns
      result = await this.tryGenericPatternsExtraction(doc);
      if (result) {
        logger.info('✓ Generic patterns extraction successful', { title: result.title });
        return result;
      }
      logger.info('✗ Generic patterns extraction failed');

      // All methods failed - throw specific error for fallback
      logger.warn('All auto-extraction methods failed, manual selection required');
      throw new Error('AUTO_EXTRACT_FAILED');

    } catch (error) {
      if (error instanceof Error && error.message === 'AUTO_EXTRACT_FAILED') {
        throw error; // Re-throw for fallback handling
      }

      logger.error('Enhanced generic adapter extraction failed', error);
      return {
        title: '',
        price: 0,
        currency: 'EUR',
        available: false,
        error: error instanceof Error ? error.message : 'Extraction failed',
      };
    }
  }

  /**
   * Extract using custom selector (for already tracked products)
   */
  private async extractWithCustomSelector(doc: Document, customSelector: string): Promise<ExtractedProductData> {
    const priceElement = doc.querySelector(customSelector);
    if (!priceElement) {
      logger.warn('Custom selector did not match any element', { selector: customSelector });
      return {
        title: '',
        price: 0,
        currency: 'EUR',
        available: false,
        error: 'Price element not found. The website structure may have changed. Please re-select price.',
      };
    }

    const priceText = priceElement.textContent || '';
    const price = parsePrice(priceText);
    const currency = detectCurrency(priceText) || 'EUR';

    if (price <= 0) {
      logger.warn('Could not parse price from selected element', {
        selector: customSelector,
        text: priceText.substring(0, 100),
      });
      return {
        title: '',
        price: 0,
        currency: 'EUR',
        available: false,
        error: 'Could not parse price. Please ensure you selected correct price element.',
      };
    }

    // Extract title and image using smart extractors
    const title = extractTitle(doc);
    const imageUrl = extractImage(doc, priceElement as HTMLElement);

    logger.info('Enhanced adapter extracted data with custom selector', {
      title,
      price,
      currency,
      hasImage: !!imageUrl,
    });

    return {
      title,
      price,
      currency,
      imageUrl,
      available: true,
    };
  }

  /**
   * Method 1: JSON-LD structured data extraction
   */
  private async tryJsonLdExtraction(doc: Document): Promise<ExtractedProductData | null> {
    try {
      const scripts = doc.querySelectorAll(
        'script[type="application/ld+json"], script[type="application/json+ld"]'
      );

      for (const script of Array.from(scripts)) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(script.textContent || '');
        } catch (parseError) {
          logger.debug('Failed to parse JSON-LD script', { error: parseError });
          continue;
        }

        const nodes = this.flattenJsonLdPayload(parsed);
        for (const node of nodes) {
          if (!this.isProductNode(node)) {
            continue;
          }

          const title = this.normalizeTitle(node) || this.siteInfo?.name || 'Producto';
          const offers = this.normalizeObjectArray(node['offers']);
          const offerCandidates = offers.length > 0 ? offers : [node];

          for (const offer of offerCandidates) {
            const price = this.extractPriceFromNode(offer);
            if (!price) {
              continue;
            }

            const currency =
              this.extractCurrencyFromNode(offer) ||
              this.extractCurrencyFromNode(node) ||
              'EUR';

            const image = this.extractImageFromNode(node);

            logger.debug('JSON-LD product found', {
              title,
              price,
              currency,
              source: 'json-ld',
            });

            return {
              title,
              price,
              currency,
              imageUrl: image,
              available: true,
            };
          }
        }
      }

      return null;
    } catch (error) {
      logger.debug('JSON-LD extraction failed', { error });
      return null;
    }
  }

  /**
   * Method 2: Meta tags extraction (Open Graph, Twitter Card)
   */
  private async tryMetaTagsExtraction(doc: Document): Promise<ExtractedProductData | null> {
    try {
      // Try Open Graph meta tags
      const title = this.getMetaContent(doc, 'og:title') || 
                    this.getMetaContent(doc, 'twitter:title');
      
      const priceText = this.getMetaContent(doc, 'og:price:amount') || 
                        this.getMetaContent(doc, 'product:price:amount') ||
                        this.getMetaContent(doc, 'twitter:data1');

      const currency = this.getMetaContent(doc, 'og:price:currency') || 
                       this.getMetaContent(doc, 'product:price:currency') ||
                       detectCurrency(priceText ?? '') || 'EUR';

      const imageUrl = this.getMetaContent(doc, 'og:image') || 
                      this.getMetaContent(doc, 'twitter:image');

      if (title && priceText) {
        const price = parsePrice(priceText);
        
        if (price > 0) {
          logger.debug('Meta tags extraction successful', { title, price, currency });
          
          return {
            title,
            price,
            currency,
            imageUrl,
            available: true,
          };
        }
      }

      return null;
    } catch (error) {
      logger.debug('Meta tags extraction failed', { error });
      return null;
    }
  }

  /**
   * Method 3: Platform-specific selectors
   */
  private async tryPlatformSelectorsExtraction(doc: Document): Promise<ExtractedProductData | null> {
    try {
      const platformSelectors = [
        // Shopify
        ['.product-price', '.product__price', '.price--main', '[data-product-price]'],
        // PrestaShop  
        ['.current-price', '.product-price', '[itemprop="price"]'],
        // Magento
        ['.price', '.product-info-price', '[data-price-type="finalPrice"]'],
        // WooCommerce
        ['.woocommerce-Price-amount', '.summary .price'],
        // BigCommerce
        ['.price-section .price', '.price-quantity'],
        // Shopify Plus variations
        ['.variant-price', '.current-variant-price'],
      ];

      let bestCandidate: PriceCandidate | null = null;

      for (const selectors of platformSelectors) {
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          for (const element of Array.from(elements)) {
            const candidate = this.buildPriceCandidate(element);
            if (!candidate) {
              continue;
            }

            if (!bestCandidate || candidate.score > bestCandidate.score) {
              bestCandidate = candidate;
            }
          }
        }
      }

      if (bestCandidate) {
        const title = extractTitle(doc);
        const imageUrl = extractImage(doc, bestCandidate.element);

        logger.debug('Platform selector extraction successful', {
          selector: bestCandidate.element.tagName.toLowerCase(),
          price: bestCandidate.price,
          score: bestCandidate.score,
        });

        return {
          title: title || 'Product',
          price: bestCandidate.price,
          currency: bestCandidate.currency,
          imageUrl,
          available: true,
        };
      }

      return null;
    } catch (error) {
      logger.debug('Platform selectors extraction failed', { error });
      return null;
    }
  }

  /**
   * Method 4: Generic CSS patterns
   */
  private async tryGenericPatternsExtraction(doc: Document): Promise<ExtractedProductData | null> {
    try {
      const genericSelectors = [
        '.price',
        '.precio', 
        '#price',
        '.product-price',
        '[class*="price"]',
        '[class*="precio"]',
        '[id*="price"]',
        '[itemprop="price"]',
        '[data-price]',
        '.current-price',
        '.sale-price',
        '.regular-price',
        '.main-price',
      ];

      let bestCandidate: PriceCandidate | null = null;

      for (const selector of genericSelectors) {
        const elements = doc.querySelectorAll(selector);
        
        for (const element of Array.from(elements)) {
          if (!this.looksLikePriceElement(element as HTMLElement)) {
            continue;
          }

          const candidate = this.buildPriceCandidate(element);
          if (!candidate) {
            continue;
          }

          if (!bestCandidate || candidate.score > bestCandidate.score) {
            bestCandidate = candidate;
          }
        }
      }

      if (bestCandidate) {
        const title = extractTitle(doc);
        const imageUrl = extractImage(doc, bestCandidate.element);

        logger.debug('Generic pattern extraction successful', {
          selector: bestCandidate.element.tagName.toLowerCase(),
          price: bestCandidate.price,
          score: bestCandidate.score,
        });

        return {
          title: title || 'Product',
          price: bestCandidate.price,
          currency: bestCandidate.currency,
          imageUrl,
          available: true,
        };
      }

      return null;
    } catch (error) {
      logger.debug('Generic patterns extraction failed', { error });
      return null;
    }
  }

  /**
   * Helper to get meta tag content
   */
  private getMetaContent(doc: Document, property: string): string | undefined {
    const meta = doc.querySelector(`meta[property="${property}"]`) || 
                doc.querySelector(`meta[name="${property}"]`) ||
                doc.querySelector(`meta[property="og:${property}"]`) ||
                doc.querySelector(`meta[name="twitter:${property}"]`);
    
    return meta?.getAttribute('content') || undefined;
  }

  /**
   * Check if element looks like a price element
   */
  private looksLikePriceElement(element: HTMLElement): boolean {
    const text = element.textContent || '';
    const className = element.className || '';
    const id = element.id || '';
    
    // Must contain numbers
    if (!/\d/.test(text)) return false;
    
    // Should contain currency symbol or price-related class/id
    const hasCurrency = /[€$£¥]/.test(text);
    const hasPriceClass = /price|precio|cost|amount/i.test(className + ' ' + id);
    
    return hasCurrency || hasPriceClass;
  }

  private buildPriceCandidate(element: Element): PriceCandidate | null {
    const text = this.extractPriceText(element);
    if (!text) {
      return null;
    }

    const price = parsePrice(text);
    if (price <= 0 || price >= 1_000_000) {
      return null;
    }

    const currency = detectCurrency(text) || 'EUR';
    if (this.isFinancingText(text) || this.isShippingText(text, price)) {
      return null;
    }
    const score = this.scorePriceElement(element as HTMLElement, price, text);

    return {
      price,
      currency,
      element: element as HTMLElement,
      score,
    };
  }

  private extractPriceText(element: Element): string | undefined {
    const attributeCandidates = [
      'content',
      'data-price',
      'data-price-value',
      'data-price-final',
      'data-amount',
      'data-value',
      'value',
      'aria-label',
    ];

    for (const attribute of attributeCandidates) {
      const value = element.getAttribute?.(attribute);
      if (value && value.trim().length > 0) {
        return value.trim();
      }
    }

    const text = element.textContent?.trim();
    return text && text.length > 0 ? text : undefined;
  }

  private scorePriceElement(element: HTMLElement, price: number, text: string): number {
    let score = 0;
    const classId = `${element.className} ${element.id}`.toLowerCase();
    const combinedText = `${text}`.toLowerCase();

    if (element.getAttribute('itemprop') === 'price') score += 5;
    if (
      element.hasAttribute('data-price') ||
      element.hasAttribute('data-price-value') ||
      element.hasAttribute('data-price-final')
    ) {
      score += 4;
    }
    if (element.tagName === 'META' || element.tagName === 'INPUT') {
      score += 3;
    }
    if (/[€$£¥]/.test(text)) {
      score += 1;
    }
    if (this.containsAncillaryKeyword(`${classId} ${combinedText}`)) {
      score -= 8;
    }

    score += Math.min(price / 200, 3); // slight preference for realistic/high prices
    return score;
  }

  private isFinancingText(text: string): boolean {
    const normalized = text.toLowerCase();
    return /cuota|financi|mensual|mes\b|meses|al mes|por mes|mensuales/.test(normalized);
  }

  private isShippingText(text: string, price: number): boolean {
    const normalized = text.toLowerCase();
    if (price > 50) {
      return false; // expensive items are unlikely to be shipping costs
    }
    return /env[ií]o|gastos|entrega|recogida|shipping|portes/.test(normalized);
  }

  private containsAncillaryKeyword(text: string): boolean {
    return /env[ií]o|gastos|mensual|cuota|financi|portes|recogida|entrega|mes\b|meses|al mes|por mes/.test(
      text.toLowerCase(),
    );
  }

  private flattenJsonLdPayload(payload: unknown): JsonObject[] {
    if (!payload) return [];

    if (Array.isArray(payload)) {
      return payload.flatMap(item => this.flattenJsonLdPayload(item));
    }

    if (typeof payload === 'object') {
      const node = payload as JsonObject;
      const result: JsonObject[] = [node];

      if (node['@graph']) {
        result.push(...this.flattenJsonLdPayload(node['@graph']));
      }

      if (node['itemListElement']) {
        result.push(...this.flattenJsonLdPayload(node['itemListElement']));
      }

      return result;
    }

    return [];
  }

  private isProductNode(node: JsonObject): boolean {
    const typeValue = node['@type'];
    if (!typeValue) return false;

    if (typeof typeValue === 'string') {
      return /product/i.test(typeValue);
    }

    if (Array.isArray(typeValue)) {
      return typeValue.some(entry => typeof entry === 'string' && /product/i.test(entry));
    }

    return false;
  }

  private normalizeTitle(node: JsonObject): string | undefined {
    const candidates = [node['name'], node['title'], node['headline']];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return undefined;
  }

  private normalizeObjectArray(value: unknown): JsonObject[] {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value
        .map(entry => (entry && typeof entry === 'object' ? (entry as JsonObject) : null))
        .filter((entry): entry is JsonObject => entry !== null);
    }

    if (value && typeof value === 'object') {
      return [value as JsonObject];
    }

    return [];
  }

  private extractPriceFromNode(node: JsonObject): number | null {
    const priceSpec = node['priceSpecification'];
    const specObjects = this.normalizeObjectArray(priceSpec);

    const values: unknown[] = [
      node['price'],
      node['priceValue'],
      node['currentPrice'],
      node['lowPrice'],
      node['highPrice'],
    ];

    for (const spec of specObjects) {
      values.push(spec['price'], spec['minPrice'], spec['maxPrice']);
    }

    for (const value of values) {
      const parsed = this.parsePriceValue(value);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  private extractCurrencyFromNode(node: JsonObject): string | undefined {
    const priceSpec = this.normalizeObjectArray(node['priceSpecification']);

    const candidates = [
      node['priceCurrency'],
      node['currency'],
      node['offersCurrency'],
      ...priceSpec.map(spec => spec['priceCurrency']),
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    const priceValue = node['price'];
    if (typeof priceValue === 'string') {
      const detected = detectCurrency(priceValue);
      if (detected) {
        return detected;
      }
    }

    return undefined;
  }

  private extractImageFromNode(node: JsonObject): string | undefined {
    const image = node['image'] ?? node['imageUrl'] ?? node['thumbnail'];

    if (typeof image === 'string') {
      return image;
    }

    if (Array.isArray(image)) {
      const firstString = image.find(item => typeof item === 'string') as string | undefined;
      return firstString;
    }

    return undefined;
  }

  private parsePriceValue(value: unknown): number | null {
    if (typeof value === 'number') {
      const normalized = this.normalizeLargeNumericPrice(value);
      return normalized;
    }

    if (typeof value === 'string') {
      const parsed = parsePrice(value);
      if (parsed > 0) {
        const normalized = this.normalizeLargeNumericPrice(parsed);
        if (normalized !== null) {
          return normalized;
        }
      }

      const digitsOnly = value.replace(/[^\d]/g, '');
      if (digitsOnly.length > 0) {
        const numeric = Number(digitsOnly);
        const normalized = this.normalizeLargeNumericPrice(numeric);
        if (normalized !== null) {
          return normalized;
        }
      }
    }

    return null;
  }

  private normalizeLargeNumericPrice(value: number): number | null {
    if (value <= 0) return null;
    if (value < 100_000) return value;

    const dividers = [10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000];
    for (const divider of dividers) {
      const normalized = value / divider;
      if (normalized >= 1 && normalized <= 10_000) {
        return normalized;
      }
    }

    return null;
  }
}

// Export factory function
export function createEnhancedGenericAdapter(siteInfo?: SupportedSite): EnhancedGenericAdapter {
  return new EnhancedGenericAdapter(siteInfo);
}


