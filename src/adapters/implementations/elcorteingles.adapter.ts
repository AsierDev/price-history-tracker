/**
 * El Corte Inglés adapter - Handles elcorteingles.es/.com product pages
 */

import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';
import { createDocument } from '../../utils/htmlParser';
import { logger } from '../../utils/logger';
import { parsePrice, detectCurrency, looksLikePrice, isOutOfStock } from '../../utils/priceUtils';
import { extractImage } from '../../utils/metadataExtractor';

type JsonObject = Record<string, unknown>;

export class ElCorteInglesAdapter implements PriceAdapter {
  name = 'elcorteingles';
  affiliateNetworkId = 'elcorteingles';
  enabled = true;
  urlPatterns = [/elcorteingles\.(es|com)\/.+/i];

  canHandle(url: string): boolean {
    return this.urlPatterns.some(pattern => pattern.test(url));
  }

  async extractData(html: string): Promise<ExtractedProductData> {
    try {
      const doc = createDocument(html);

      // PRIORITY 1: DataLayer (Most reliable for El Corte Inglés)
      const dataLayerResult = this.extractFromDataLayer(doc);
      if (dataLayerResult) {
        return dataLayerResult;
      }

      // PRIORITY 2: JSON-LD (Fixed logic to prefer SalePrice)
      const jsonLdResult = this.extractFromJsonLd(doc);
      
      // PRIORITY 3: HTML Fallback
      const htmlPriceInfo = this.extractPrice(doc);
      
      // Base data from JSON-LD if available, otherwise HTML
      const result: ExtractedProductData = jsonLdResult || {
        title: this.extractTitle(doc),
        price: 0,
        currency: 'EUR',
        imageUrl: this.extractHeroImage(doc),
        available: this.checkAvailability(doc),
      };

      // If we have an HTML price, compare it with JSON-LD price
      if (htmlPriceInfo && htmlPriceInfo.price > 0) {
        // Sanity check: If HTML price is suspiciously low compared to JSON-LD price (e.g. < 20%),
        // it's likely a shipping cost, accessory, or installment price (e.g. 7.90€ vs 1999€).
        // Unless JSON-LD price is 0, in which case we have no baseline.
        const isSuspiciouslyLow = result.price > 0 && (htmlPriceInfo.price / result.price < 0.2);
        
        if (isSuspiciouslyLow) {
          logger.warn('Ignoring suspiciously low HTML price', { 
            htmlPrice: htmlPriceInfo.price, 
            jsonLdPrice: result.price,
            url: this.urlPatterns[0] // context
          });
        } else {
          // If JSON-LD failed or HTML price is lower (and valid), use HTML price
          // This handles cases where JSON-LD has original price (1999) but HTML has sale price (999)
          if (result.price === 0 || htmlPriceInfo.price < result.price) {
            result.price = htmlPriceInfo.price;
            result.currency = htmlPriceInfo.currency;
          }
        }
        
        // If JSON-LD missed other fields, fill them from HTML
        if (!result.title || result.title === 'Producto El Corte Inglés') {
          result.title = this.extractTitle(doc);
        }
        if (!result.imageUrl) {
          result.imageUrl = this.extractHeroImage(doc);
        }
        // HTML availability check is often more up-to-date
        if (!result.available) {
           result.available = this.checkAvailability(doc);
        }
      }

      if (result.price === 0) {
        return {
          ...result,
          error: 'Price not found',
        };
      }

      return result;
    } catch (error) {
      logger.error('El Corte Inglés extraction failed', error);
      return {
        title: 'Producto',
        price: 0,
        currency: 'EUR',
        available: false,
        error: error instanceof Error ? error.message : 'Extraction failed',
      };
    }
  }

  generateAffiliateUrl(url: string): string {
    return url;
  }

  private extractFromDataLayer(doc: Document): ExtractedProductData | null {
    try {
      const scripts = doc.querySelectorAll('script');
      for (const script of Array.from(scripts)) {
        const content = script.textContent || '';
        if (content.includes('dataLayer =')) {
          // Extract the array content
          const match = content.match(/dataLayer\s*=\s*(\[.*?\]);/s);
          if (match && match[1]) {
            // Safe parsing of the JS object
            // We can't use JSON.parse directly because it might not be valid JSON (keys without quotes)
            // But usually dataLayer is valid JSON or close to it.
            // In the user example it IS valid JSON.
            try {
              const data = JSON.parse(match[1]);
              if (Array.isArray(data)) {
                for (const item of data) {
                  if (item.product && item.product.price) {
                    const p = item.product;
                    const priceObj = p.price;
                    // f_price seems to be final price, o_price original
                    const price = priceObj.f_price || priceObj.price || 0;
                    
                    if (price > 0) {
                      return {
                        title: p.name || 'Producto El Corte Inglés',
                        price: Number(price),
                        currency: priceObj.currency || 'EUR',
                        imageUrl: p.image || undefined, // dataLayer might not have image
                        available: true // Assume available if in dataLayer product view
                      };
                    }
                  }
                }
              }
            } catch (e) {
              // JSON parse failed, try regex extraction as fallback
              const priceMatch = content.match(/"f_price":\s*(\d+(\.\d+)?)/);
              if (priceMatch && priceMatch[1]) {
                 return {
                    title: 'Producto El Corte Inglés', // Will be filled by other extractors
                    price: Number(priceMatch[1]),
                    currency: 'EUR',
                    available: true
                 };
              }
            }
          }
        }
      }
    } catch (e) {
      logger.warn('DataLayer extraction failed', { error: e });
    }
    return null;
  }

  private extractFromJsonLd(doc: Document): ExtractedProductData | null {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

    for (const script of Array.from(scripts)) {
      let payload: unknown;
      try {
        payload = JSON.parse(script.textContent || '');
      } catch {
        continue;
      }

      const nodes = this.flattenJsonLd(payload);
      for (const node of nodes) {
        const type = node['@type'];
        if (!type || (typeof type === 'string' && type !== 'Product')) {
          continue;
        }

        const title =
          typeof node.name === 'string'
            ? node.name.trim()
            : typeof node.headline === 'string'
              ? node.headline.trim()
              : undefined;

        const offerInfo = this.parseOfferNode(node.offers ?? node);
        if (!offerInfo) {
          continue;
        }

        const image =
          typeof node.image === 'string'
            ? node.image
            : Array.isArray(node.image)
              ? node.image.find(entry => typeof entry === 'string')
              : undefined;

        return {
          title: title ?? 'Producto El Corte Inglés',
          price: offerInfo.price,
          currency: offerInfo.currency,
          imageUrl: image,
          available: offerInfo.available,
        };
      }
    }

    return null;
  }

  private extractTitle(doc: Document): string {
    const selectors = [
      'h1[data-product-name]',
      'h1[data-name]',
      '.product-title',
      '.product-name',
      'h1',
    ];

    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      if (el?.textContent) {
        const text = el.textContent.trim();
        if (text.length > 0) {
          return text;
        }
      }
    }

    return 'Producto El Corte Inglés';
  }

  private extractPrice(doc: Document): { price: number; currency: string } | null {
    const preferredSelectors = [
      '[aria-label="Precio de venta"]',
      '.price-sale',
      '.price__current',
      '.price-container [data-price="sale"]',
      '[data-testid="price-sale"]',
    ];

    const preferred = this.extractFromSelectorList(doc, preferredSelectors);
    if (preferred) {
      return preferred;
    }

    const selectors = [
      '[data-test="price-main"]',
      '[itemprop="price"]',
      '[data-price]',
      '[data-price-value]',
      '[data-price-final]',
      'meta[property="product:price:amount"]',
      'meta[name="twitter:data1"]',
    ];

    const fallback = this.extractFromSelectorList(doc, selectors);
    if (fallback) {
      return fallback;
    }

    // fallback scanning
    const elements = doc.querySelectorAll('span, div');
    for (const el of Array.from(elements)) {
      if (!looksLikePrice(el.textContent || '')) continue;
      if (!this.isLikelyProductPrice(el as HTMLElement)) continue;

      const price = parsePrice(el.textContent || '');
      if (price > 0) {
        return {
          price,
          currency: detectCurrency(el.textContent || '') || 'EUR',
        };
      }
    }

    return null;
  }

  private extractFromSelectorList(
    doc: Document,
    selectors: string[],
  ): { price: number; currency: string } | null {
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      const parsed = this.parsePriceElement(element);
      if (parsed) {
        return parsed;
      }
    }
    return null;
  }

  private extractHeroImage(doc: Document): string | undefined {
    const selectors = [
      'meta[property="og:image"]',
      '.gallery__image img',
      '.carousel__image img',
      'img[data-src]',
    ];

    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      if (!el) continue;

      const src = this.resolveImageSource(el);

      if (src) {
        return src;
      }
    }

    return extractImage(doc) ?? undefined;
  }

  private resolveImageSource(element: Element): string | undefined {
    const tagName = (element.tagName || '').toLowerCase();
    if (tagName === 'meta') {
      const content = element.getAttribute('content');
      if (content && content.trim().length > 0) {
        return content.trim();
      }
    }

    const attributes = ['data-src', 'data-original', 'data-lazy-src', 'src'];
    for (const attr of attributes) {
      const value = element.getAttribute?.(attr);
      if (value && value.trim().length > 0) {
        return value.trim();
      }
    }

    const withCurrentSrc = element as HTMLElement & { currentSrc?: string };
    if (withCurrentSrc.currentSrc && withCurrentSrc.currentSrc.trim().length > 0) {
      return withCurrentSrc.currentSrc;
    }

    return undefined;
  }

  private checkAvailability(doc: Document): boolean {
    const selectors = ['.availability', '.stock-status', '[data-availability]'];

    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      const text = el?.textContent?.toLowerCase() || '';
      if (text && isOutOfStock(text)) {
        return false;
      }

      const attr = el?.getAttribute('data-availability');
      if (attr && isOutOfStock(attr)) {
        return false;
      }
    }

    return true;
  }

  private extractPriceText(element: Element | null): string | null {
    if (!element) return null;

    // PRIORITY 1: For El Corte Inglés price-sale elements, be smart about ignoring the original price.
    // Instead of just looking at direct text (which fails if the sale price is in a span),
    // we clone the node, remove the "original" price elements, and take what's left.
    if (element.classList?.contains('price-sale') || element.getAttribute('aria-label') === 'Precio de venta') {
      try {
        // Create a dummy wrapper to clone the element (linkedom/DOM compatible)
        const clone = element.cloneNode(true) as Element;
        
        // Remove known "original price" elements from the clone
        const originalPriceSelectors = [
          '.price-unit--original',
          '.price-original',
          '.strike',
          '.strikethrough',
          'del',
          '[data-price-original]'
        ];

        originalPriceSelectors.forEach(selector => {
          const badElements = clone.querySelectorAll(selector);
          badElements.forEach(el => el.remove());
        });

        const cleanText = clone.textContent?.trim() || '';
        if (cleanText.length > 0) {
          return cleanText;
        }
      } catch (e) {
        // If cloning fails (unlikely), fall back to direct text
        let directText = '';
        for (const node of Array.from(element.childNodes)) {
          if (node.nodeType === 3) { // Node.TEXT_NODE
            directText += node.textContent || '';
          }
        }
        const trimmed = directText.trim();
        if (trimmed.length > 0) return trimmed;
      }
    }

    // PRIORITY 2: Check attributes as fallback
    const attrs = ['content', 'data-price', 'data-price-value', 'data-price-final', 'data-value'];
    for (const attr of attrs) {
      const val = element.getAttribute?.(attr);
      if (val && val.trim().length > 0) {
        return val.trim();
      }
    }

    // PRIORITY 3: Generic text content
    const text = element.textContent?.trim() || '';
    return text.length > 0 ? text : null;
  }

  private extractCurrency(element: Element | null): string | undefined {
    if (!element) return undefined;
    const attr = element.getAttribute('data-price-currency') ?? element.getAttribute('data-currency');
    return attr ?? undefined;
  }

  private isLikelyProductPrice(element: HTMLElement): boolean {
    const text = element.textContent || '';
    if (!/[€$£¥]/.test(text)) return false;
    const className = element.className || '';
    const id = element.id || '';
    const combined = `${className} ${id}`.toLowerCase();
    return /price|precio|amount|cost/i.test(combined);
  }

  private parsePriceElement(element: Element | null): { price: number; currency: string } | null {
    if (!element) {
      return null;
    }

    const text = this.extractPriceText(element);
    if (!text) {
      return null;
    }

    const price = parsePrice(text);
    if (price <= 0) {
      return null;
    }

    return {
      price,
      currency: detectCurrency(text) || this.extractCurrency(element) || 'EUR',
    };
  }

  private flattenJsonLd(payload: unknown): JsonObject[] {
    if (!payload) return [];

    if (Array.isArray(payload)) {
      return payload.flatMap(entry => this.flattenJsonLd(entry));
    }

    if (typeof payload === 'object') {
      const node = payload as JsonObject;
      const result: JsonObject[] = [node];

      if (node['@graph']) {
        result.push(...this.flattenJsonLd(node['@graph']));
      }

      return result;
    }

    return [];
  }

  private parseOfferNode(raw: unknown): { price: number; currency: string; available: boolean } | null {
    const queue: unknown[] = [];
    if (Array.isArray(raw)) {
      queue.push(...raw);
    } else if (raw) {
      queue.push(raw);
    }

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || typeof current !== 'object') continue;

      const offer = current as JsonObject;
      if (offer.offers) {
        queue.push(offer.offers);
      }

      const priceSpec = this.toJsonObject(offer.priceSpecification);

      const priceCandidate =
        offer.price ??
        offer.priceValue ??
        offer.lowPrice ??
        offer.highPrice ??
        priceSpec?.price;

      const price =
        typeof priceCandidate === 'number'
          ? priceCandidate
          : typeof priceCandidate === 'string'
            ? parsePrice(priceCandidate)
            : 0;

      if (price > 0) {
        const currency =
          offer.priceCurrency ??
          priceSpec?.priceCurrency ??
          detectCurrency(String(priceCandidate ?? '')) ??
          'EUR';

        const availability = offer.availability || '';
        return {
          price,
          currency: typeof currency === 'string' ? currency : 'EUR',
          available: availability ? !isOutOfStock(String(availability)) : true,
        };
      }
    }

    return null;
  }

  private toJsonObject(value: unknown): JsonObject | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as JsonObject;
    }
    return null;
  }
}
