/**
 * PcComponentes adapter - Specific extraction logic for pccomponentes.com
 */

import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';
import { createDocument } from '../../utils/htmlParser';
import { logger } from '../../utils/logger';
import { parsePrice, detectCurrency, looksLikePrice, isOutOfStock } from '../../utils/priceUtils';
import { extractImage } from '../../utils/metadataExtractor';

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

      const jsonResult = this.extractFromJsonLd(doc);
      if (jsonResult) {
        return jsonResult;
      }

      const title = this.extractTitle(doc);
      const priceInfo = this.extractPrice(doc);
      const available = this.checkAvailability(doc);
      const imageUrl = this.extractHeroImage(doc);

      if (!priceInfo) {
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
    for (const script of Array.from(scripts)) {
      try {
        const json = JSON.parse(script.textContent || '{}');
        const graph = Array.isArray(json['@graph']) ? json['@graph'] : [json];
        for (const node of graph) {
          if (node['@type'] === 'Product') {
            const offers = node.offers || node.offers?.[0];
            const price = parseFloat(offers?.price ?? node.price ?? '0');
            const currency = offers?.priceCurrency || node.priceCurrency || 'EUR';
            if (!price) continue;
            return {
              title: node.name || 'Producto',
              price,
              currency,
              imageUrl: typeof node.image === 'string' ? node.image : undefined,
              available: offers?.availability ? !isOutOfStock(String(offers.availability)) : true,
            };
          }
        }
      } catch {
        // Ignore invalid JSON
      }
    }
    return null;
  }

  private extractTitle(doc: Document): string {
    const selectors = [
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
    const selectors = [
      '.pdp-price__current',
      '.ficha-producto__price-current',
      '.price-current',
      '.prices .price',
      '.product-price__current',
      '.PriceCard-module_price__value__',
      '[data-product-price]',
      '.product-price',
    ];

    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      const text = el?.textContent?.trim();
      if (text && looksLikePrice(text)) {
        const price = parsePrice(text);
        if (price > 0) {
          return {
            price,
            currency: detectCurrency(text),
          };
        }
      }
    }

    // Last resort: find any price-looking string
    const candidates = Array.from(doc.querySelectorAll('span, div, p'))
      .map(node => node.textContent?.trim() || '')
      .filter(text => looksLikePrice(text));

    for (const text of candidates) {
      const price = parsePrice(text);
      if (price > 0) {
        return {
          price,
          currency: detectCurrency(text),
        };
      }
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
}
