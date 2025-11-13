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

      const jsonLdResult = this.extractFromJsonLd(doc);
      if (jsonLdResult) {
        return jsonLdResult;
      }

      const title = this.extractTitle(doc);
      const priceInfo = this.extractPrice(doc);
      const imageUrl = this.extractHeroImage(doc);
      const available = this.checkAvailability(doc);

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
      const el = doc.querySelector(selector) as HTMLImageElement | HTMLMetaElement | null;
      if (!el) continue;

      const src =
        el instanceof HTMLMetaElement
          ? el.content
          : el.getAttribute('data-src') || el.src || el.currentSrc;

      if (src) {
        return src;
      }
    }

    return extractImage(doc) ?? undefined;
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

    const attrs = ['content', 'data-price', 'data-price-value', 'data-price-final', 'data-value'];
    for (const attr of attrs) {
      const val = element.getAttribute?.(attr);
      if (val && val.trim().length > 0) {
        return val.trim();
      }
    }

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
