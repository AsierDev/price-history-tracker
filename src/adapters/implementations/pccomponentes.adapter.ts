/**
 * PcComponentes adapter - Specific extraction logic for pccomponentes.com
 */

import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';
import { createDocument } from '../../utils/htmlParser';
import { logger } from '../../utils/logger';
import { parsePrice, detectCurrency, looksLikePrice, isOutOfStock } from '../../utils/priceUtils';
import { extractImage } from '../../utils/metadataExtractor';

const TEXT_NODE_TYPE = typeof Node !== 'undefined' ? Node.TEXT_NODE : 3;

export class PcComponentesAdapter implements PriceAdapter {
  name = 'pccomponentes';
  affiliateNetworkId = 'pccomponentes';
  enabled = true;
  urlPatterns = [/pccomponentes\.com\//i];

  canHandle(url: string): boolean {
    return this.urlPatterns.some(pattern => pattern.test(url));
  }

  async extractData(html: string): Promise<ExtractedProductData> {
    try {
      const doc = createDocument(html);

      const title = this.extractTitle(doc);
      const priceInfo = this.extractPrice(doc);
      const available = this.checkAvailability(doc);
      const imageUrl = this.extractHeroImage(doc);

      if (!priceInfo) {
        const jsonResult = this.extractFromJsonLd(doc);
        if (jsonResult) {
          return {
            title: jsonResult.title || title,
            price: jsonResult.price,
            currency: jsonResult.currency,
            imageUrl: jsonResult.imageUrl ?? imageUrl,
            available: jsonResult.available,
          };
        }

        return {
          title,
          price: 0,
          currency: 'EUR',
          available: false,
          error: 'Price not found',
        };
      }

      return {
        title,
        price: priceInfo.price,
        currency: priceInfo.currency,
        imageUrl,
        available,
      };
    } catch (error) {
      logger.error('PcComponentes extraction failed', error);
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

  private extractFromJsonLd(doc: Document): ExtractedProductData | null {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    const canonicalUrl = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
    const fallbackCandidates: ExtractedProductData[] = [];

    for (const script of Array.from(scripts)) {
      try {
        const json = JSON.parse(script.textContent || '{}');
        const graph = Array.isArray(json['@graph']) ? json['@graph'] : [json];

        for (const node of graph) {
          if (node['@type'] !== 'Product') {
            continue;
          }

          const data = this.buildProductFromNode(node);
          if (!data) {
            continue;
          }

          if (canonicalUrl && this.matchesCanonical(node, canonicalUrl)) {
            return data;
          }

          fallbackCandidates.push(data);
        }
      } catch {
        // Ignore invalid JSON
      }
    }

    return fallbackCandidates[0] ?? null;
  }

  private extractTitle(doc: Document): string {
    const selectors = [
      '#pdp-title',
      '.title-CVEHt4',
      '.ficha-producto__header-title',
      '.ficha-producto__name',
      '.product-card__title',
      'h1[itemprop="name"]',
      'h1',
    ];

    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      if (el?.textContent) {
        return el.textContent.trim();
      }
    }

    return 'Producto PC Componentes';
  }

  private extractPrice(doc: Document): { price: number; currency: string } | null {
    const structured = this.extractStructuredPrice(doc);
    if (structured) {
      return structured;
    }

    const preferredSelectors = [
      '[data-e2e="product-price-current"]',
      '.pdp-price__current',
      '.product-hero__price-current',
      '.price-box__current',
      '.price-current',
      '.price-sale',
      '.product-price__current',
      '.PriceCard-module_price__value__',
      '[data-product-price]',
    ];

    for (const selector of preferredSelectors) {
      const el = doc.querySelector(selector);
      const parsed = this.parsePriceElement(el);
      if (parsed) {
        return parsed;
      }
    }

    const fallbackSelectors = [
      '.prices .price',
      '.product-price',
      '[itemprop="price"]',
      'meta[property="product:price:amount"]',
      'meta[name="twitter:data1"]',
    ];

    for (const selector of fallbackSelectors) {
      const el = doc.querySelector(selector);
      const parsed = this.parsePriceElement(el);
      if (parsed) {
        return parsed;
      }
    }

    // Last resort: scan for price-looking nodes
    const candidates = Array.from(doc.querySelectorAll('span, div, p')).filter(node =>
      looksLikePrice(node.textContent || ''),
    );

    for (const node of candidates) {
      const parsed = this.parsePriceElement(node);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  private extractStructuredPrice(doc: Document): { price: number; currency: string } | null {
    const container = doc.querySelector('#pdp-price-current-container');
    if (!container) {
      return null;
    }

    const integerEl = container.querySelector('#pdp-price-current-integer');
    const decimalsEl = container.querySelector('#pdp-price-current-decimals');

    const integerText = this.getFirstTextNode(integerEl);
    const decimalsText = decimalsEl?.textContent?.trim() ?? '';

    if (!integerText) {
      return null;
    }

    const normalized = `${integerText.trim()}${decimalsText}`;
    const price = parsePrice(normalized);
    if (price > 0) {
      return {
        price,
        currency: detectCurrency(decimalsText) || 'EUR',
      };
    }

    return null;
  }

  private extractHeroImage(doc: Document): string | undefined {
    const selectors = [
      '.ficha-producto__gallery img',
      '.ficha-producto__image img',
      '.product-gallery__image img',
      '[data-gallery-image]',
      'img[data-testid="product-image"]',
    ];

    for (const selector of selectors) {
      const img = doc.querySelector(selector) as HTMLImageElement | null;
      if (img?.src) {
        return img.src;
      }
    }

    return extractImage(doc) ?? undefined;
  }

  private checkAvailability(doc: Document): boolean {
    const availabilitySelectors = [
      '.ficha-producto__availability',
      '.product-stock',
      '.availability',
      '[data-testid="availability"]',
    ];

    for (const selector of availabilitySelectors) {
      const el = doc.querySelector(selector);
      const text = el?.textContent?.toLowerCase() || '';
      if (text && isOutOfStock(text)) {
        return false;
      }
    }

    return true;
  }

  private parsePriceElement(element: Element | null): { price: number; currency: string } | null {
    if (!element) return null;

    const text = element.textContent?.trim() || '';
    if (!text) {
      return this.parsePriceAttributes(element);
    }

    if (looksLikePrice(text)) {
      const price = parsePrice(text);
      if (price > 0) {
        return {
          price,
          currency: detectCurrency(text),
        };
      }
    }

    return this.parsePriceAttributes(element);
  }

  private parsePriceAttributes(element: Element | null): { price: number; currency: string } | null {
    if (!element) return null;

    const attributeCandidates = [
      'data-price-final',
      'data-price',
      'data-price-value',
      'data-price-current',
      'data-amount',
      'content',
    ];

    for (const attr of attributeCandidates) {
      const raw = element.getAttribute?.(attr);
      const price = this.parseNumericValue(raw);
      if (price) {
        return { price, currency: 'EUR' };
      }
    }

    return null;
  }

  private parseNumericValue(value: string | null): number | null {
    if (!value) return null;
    const normalized = value.replace(/[^\d.,-]/g, '');
    if (!normalized) return null;

    if (normalized.includes(',') || normalized.includes('.')) {
      const textualPrice = parsePrice(normalized);
      if (textualPrice > 0) {
        return textualPrice;
      }
    }

    const digitsOnly = normalized.replace(/\D/g, '');
    if (!digitsOnly) return null;

    const intValue = Number(digitsOnly);
    if (!Number.isFinite(intValue) || intValue <= 0) {
      return null;
    }

    if (intValue >= 10000) {
      const scaled = this.normalizeIntegerPrice(intValue);
      if (scaled) {
        return scaled;
      }
    }

    return intValue;
  }

  private normalizeIntegerPrice(value: number): number | null {
    const divisors = [100, 1000, 10000];
    for (const divisor of divisors) {
      const scaled = value / divisor;
      if (scaled >= 1 && scaled <= 10000) {
        return scaled;
      }
    }
    return null;
  }

  private normalizeOffers(offers: unknown): { price?: number | string; priceCurrency?: string; availability?: string; url?: string } {
    if (Array.isArray(offers)) {
      return (offers[0] ?? {}) as Record<string, string | number>;
    }
    if (offers && typeof offers === 'object') {
      return offers as Record<string, string | number>;
    }
    return {};
  }

  private parseJsonPrice(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parsePrice(value);
      if (parsed > 0) {
        return parsed;
      }

      const fallback = Number(value.replace(',', '.'));
      if (fallback > 0) {
        return fallback;
      }
    }

    return 0;
  }

  private buildProductFromNode(node: Record<string, unknown>): ExtractedProductData | null {
    const offers = this.normalizeOffers(node.offers);
    const price = this.parseJsonPrice(offers?.price ?? node.price);
    if (!price) {
      return null;
    }

    const currency = offers?.priceCurrency || node.priceCurrency || 'EUR';
    const availabilityFlag = offers?.availability ? !isOutOfStock(String(offers.availability)) : true;
    const image =
      typeof node.image === 'string'
        ? node.image
        : Array.isArray(node.image)
          ? node.image.find(entry => typeof entry === 'string')
          : undefined;

    return {
      title: typeof node.name === 'string' ? node.name : 'Producto',
      price,
      currency: typeof currency === 'string' ? currency : 'EUR',
      imageUrl: image,
      available: availabilityFlag,
    };
  }

  private matchesCanonical(node: Record<string, unknown>, canonicalUrl: string): boolean {
    if (!canonicalUrl) {
      return false;
    }

    const offers = this.normalizeOffers(node.offers);
    const urlCandidates = [node.url, node['@id'], offers.url];
    return urlCandidates.some(candidate => {
      if (typeof candidate !== 'string') return false;
      try {
        const normalized = new URL(candidate, canonicalUrl).href;
        return normalized === canonicalUrl || canonicalUrl.includes(normalized);
      } catch {
        return false;
      }
    });
  }

  private getFirstTextNode(element: Element | null): string | undefined {
    if (!element) return undefined;
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === TEXT_NODE_TYPE) {
        const value = node.textContent?.trim();
        if (value) {
          return value;
        }
      }
    }
    return element.textContent ?? undefined;
  }
}
