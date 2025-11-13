/**
 * Enhanced Generic Adapter - Smart auto-detection for whitelist sites
 * Implements cascading extraction with 70-80% success rate
 */

import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';
import type { SupportedSite } from '../../config/supportedSites';
import { logger } from '../../utils/logger';
import { createDocument } from '../../utils/htmlParser';
import { parsePrice, detectCurrency } from '../../utils/priceUtils';
import { extractTitle, extractImage } from '../../utils/metadataExtractor';

export class EnhancedGenericAdapter implements PriceAdapter {
  name = 'enhanced-generic';
  affiliateNetworkId = 'none';
  enabled = true;
  urlPatterns: RegExp[] = [/.*/]; // Matches everything (used for whitelist sites)
  requiresManualSelection = false; // Auto-detection enabled

  constructor(private siteInfo?: SupportedSite) {}

  /**
   * Enhanced adapter can handle any URL (used for whitelist sites)
   */
  canHandle(_url: string): boolean {
    return true;
  }

  /**
   * Extract product data using cascading auto-detection
   * Tries multiple methods in order of reliability
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
      const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      
      for (const script of Array.from(scripts)) {
        try {
          const data = JSON.parse(script.textContent || '');
          
          // Handle both single object and @graph array
          const products = Array.isArray(data) ? data : 
                          data['@graph'] ? (Array.isArray(data['@graph']) ? data['@graph'] : [data['@graph']]) :
                          [data];

          for (const product of products) {
            if (product['@type'] === 'Product' || product['@type'] === 'Offer' || product['@type'] === 'AggregateOffer') {
              const title = product.name || product.title;
              let price = 0;
              let currency = 'EUR';

              // Extract price from different structures
              if (product.offers) {
                const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                price = parseFloat(offers.price || offers.priceSpecification?.price || 0);
                currency = offers.priceCurrency || offers.priceSpecification?.priceCurrency || 'EUR';
              } else if (product.price) {
                price = parseFloat(product.price);
                currency = product.priceCurrency || 'EUR';
              }

              if (title && price > 0) {
                const imageUrl = product.image || product.imageUrl;
                
                logger.debug('JSON-LD product found', { title, price, currency });
                
                return {
                  title: typeof title === 'string' ? title : String(title),
                  price,
                  currency,
                  imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
                  available: true,
                };
              }
            }
          }
        } catch (parseError) {
          logger.debug('Failed to parse JSON-LD script', { error: parseError });
          continue; // Try next script
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

      for (const selectors of platformSelectors) {
        for (const selector of selectors) {
          const element = doc.querySelector(selector);
          if (element?.textContent) {
            const text = element.textContent.trim();
            const price = parsePrice(text);
            
            if (price > 0) {
              const currency = detectCurrency(text) || 'EUR';
              const title = extractTitle(doc);
              const imageUrl = extractImage(doc, element as HTMLElement);
              
              logger.debug('Platform selector extraction successful', { 
                selector, 
                title: title?.substring(0, 50), 
                price 
              });
              
              return {
                title: title || 'Product',
                price,
                currency,
                imageUrl,
                available: true,
              };
            }
          }
        }
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

      for (const selector of genericSelectors) {
        const elements = doc.querySelectorAll(selector);
        
        for (const element of Array.from(elements)) {
          const text = element.textContent?.trim() || '';
          const price = parsePrice(text);
          
          if (price > 0 && this.looksLikePriceElement(element as HTMLElement)) {
            const currency = detectCurrency(text) || 'EUR';
            const title = extractTitle(doc);
            const imageUrl = extractImage(doc, element as HTMLElement);
            
            logger.debug('Generic pattern extraction successful', { 
              selector, 
              text: text.substring(0, 30), 
              price 
            });
            
            return {
              title: title || 'Product',
              price,
              currency,
              imageUrl,
              available: true,
            };
          }
        }
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

  /**
   * Enhanced adapter doesn't support affiliate URLs
   */
  generateAffiliateUrl(url: string): string {
    return url;
  }
}

// Export factory function
export function createEnhancedGenericAdapter(siteInfo?: SupportedSite): EnhancedGenericAdapter {
  return new EnhancedGenericAdapter(siteInfo);
}
