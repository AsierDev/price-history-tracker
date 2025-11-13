/**
 * MediaMarkt adapter - Specific extraction logic for mediamarkt.* domains
 */

import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';
import { createDocument } from '../../utils/htmlParser';
import { logger } from '../../utils/logger';
import { parsePrice, detectCurrency, looksLikePrice, isOutOfStock } from '../../utils/priceUtils';
import { extractImage } from '../../utils/metadataExtractor';

type JsonObject = Record<string, unknown>;

export class MediaMarktAdapter implements PriceAdapter {
  name = 'mediamarkt';
  affiliateNetworkId = 'mediamarkt';
  enabled = true;
  urlPatterns = [/mediamarkt\.[a-z.]+\/.+/i];

  canHandle(url: string): boolean {
    return this.urlPatterns.some(pattern => pattern.test(url));
  }

  async extractData(html: string): Promise<ExtractedProductData> {
    try {
      const doc = createDocument(html);

      const jsonResult = this.extractFromJsonLd(doc);

      const domTitle = this.extractTitle(doc);
      const title =
        domTitle && domTitle !== 'Producto MediaMarkt'
          ? domTitle
          : jsonResult?.title ?? domTitle;
      const priceInfo =
        this.extractPrice(doc) ??
        (jsonResult
          ? {
              price: jsonResult.price,
              currency: jsonResult.currency,
            }
          : null);

      const available = this.checkAvailability(doc);
      const imageUrl = this.extractHeroImage(doc) ?? jsonResult?.imageUrl;

      if (!priceInfo || priceInfo.price <= 0) {
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
      logger.error('MediaMarkt extraction failed', error);
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
      let parsed: unknown;
      try {
        parsed = JSON.parse(script.textContent || '{}');
      } catch {
        continue;
      }

      const nodes = this.flattenJsonLd(parsed);
      for (const node of nodes) {
        const nodeType = node['@type'];
        if (typeof nodeType !== 'string' || nodeType !== 'Product') {
          continue;
        }

        const offerInfo = this.parseOfferNode(node['offers'] ?? node);
        if (!offerInfo) {
          continue;
        }

        const title =
          typeof node['name'] === 'string'
            ? (node['name'] as string).trim()
            : typeof node['headline'] === 'string'
              ? (node['headline'] as string).trim()
              : 'Producto MediaMarkt';

        const imageValue = node['image'] ?? node['images'];
        const imageUrl = this.normalizeImageSource(imageValue);

        return {
          title,
          price: offerInfo.price,
          currency: offerInfo.currency,
          imageUrl,
          available: offerInfo.available,
        };
      }
    }
    return null;
  }

  private extractTitle(doc: Document): string {
    const selectors = [
      '.product-title',
      '.m-productDetails__title',
      'h1[data-test="product-title"]',
      'h1',
    ];

    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      if (el?.textContent) {
        return el.textContent.trim();
      }
    }

    return 'Producto MediaMarkt';
  }

  private extractPrice(doc: Document): { price: number; currency: string } | null {
    const brandedPrice = this.extractBrandedPrice(doc);
    if (brandedPrice) {
      return brandedPrice;
    }

    const selectors = [
      '.price-tag .price',
      '.m-priceBox__price',
      '.pdp-price',
      '.price__wrapper .price',
      '.price-format',
      '.product-price',
      '[data-test="product-price"]',
      '.price__value',
      'meta[itemprop="price"]',
      'meta[property="product:price:amount"]',
      '[itemprop="price"]',
      'meta[name="twitter:data1"]',
    ];

    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      const text = this.extractPriceText(el);
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

    const fallbackTexts = Array.from(doc.querySelectorAll('span, div'))
      .map(node => node.textContent?.trim() || '')
      .filter(text => looksLikePrice(text));

    for (const text of fallbackTexts) {
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

  private extractBrandedPrice(doc: Document): { price: number; currency: string } | null {
    const wholeEl = doc.querySelector('[data-test="branded-price-whole-value"]');
    if (!wholeEl) return null;

    const decimalEl = doc.querySelector('[data-test="branded-price-decimal-value"]');
    const currencyEl = doc.querySelector('[data-test="branded-price-currency"]');

    const wholeDigits = this.extractDigits(wholeEl.textContent);
    if (!wholeDigits) return null;

    const decimalDigits = this.extractDigits(decimalEl?.textContent ?? '');
    const composed = decimalDigits ? `${wholeDigits},${decimalDigits}` : wholeDigits;
    const currencyText = currencyEl?.textContent ?? '€';

    const parsed = parsePrice(`${composed} ${currencyText}`);
    if (parsed > 0) {
      return {
        price: parsed,
        currency: detectCurrency(currencyText),
      };
    }

    return null;
  }

  private extractHeroImage(doc: Document): string | undefined {
    const selectors = [
      '.m-productGallery__image img',
      '.m-product-media-gallery img',
      '.product-gallery img',
      '[data-test="gallery-image"] img',
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
    ];

    for (const selector of selectors) {
      const img = doc.querySelector(selector) as HTMLImageElement | null;
      const candidate =
        img?.getAttribute?.('data-src') ||
        img?.getAttribute?.('data-srcset')?.split(' ')[0] ||
        img?.getAttribute?.('src') ||
        img?.getAttribute?.('content');

      const normalized = this.normalizeImageSource(candidate);
      if (normalized) {
        return normalized;
      }
    }

    const fallback = extractImage(doc);
    return fallback ? this.normalizeImageSource(fallback) : undefined;
  }

  private checkAvailability(doc: Document): boolean {
    const selectors = [
      '.product-availability',
      '.m-availability',
      '[data-test="availability-text"]',
      '.availability',
    ];

    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      const text = el?.textContent?.toLowerCase() || '';
      if (text && isOutOfStock(text)) {
        return false;
      }
    }

    return true;
  }

  private extractPriceText(element: Element | null): string | null {
    if (!element) return null;

    const attributeCandidates = [
      element.getAttribute?.('content'),
      element.getAttribute?.('data-price'),
      element.getAttribute?.('data-price-value'),
      element.getAttribute?.('data-value'),
      element.getAttribute?.('aria-label'),
    ];

    for (const attr of attributeCandidates) {
      if (attr && attr.trim().length > 0) {
        return attr.trim();
      }
    }

    const text = element.textContent?.trim() || '';
    return text.length > 0 ? text : null;
  }

  private flattenJsonLd(payload: unknown): JsonObject[] {
    if (!payload) return [];

    if (Array.isArray(payload)) {
      return payload.flatMap(entry => this.flattenJsonLd(entry));
    }

    if (typeof payload === 'object') {
      const node = payload as JsonObject;
      const result: JsonObject[] = [];

      if (typeof node['@type'] === 'string') {
        result.push(node);
      }

      const graph = node['@graph'];
      if (Array.isArray(graph)) {
        result.push(...this.flattenJsonLd(graph));
      }

      return result;
    }

    return [];
  }

  private parseOfferNode(
    rawOffers: unknown
  ): { price: number; currency: string; available: boolean } | null {
    const queue: unknown[] = [];
    const candidates: Array<{ price: number; currency: string; available: boolean }> = [];

    if (Array.isArray(rawOffers)) {
      queue.push(...rawOffers);
    } else if (rawOffers) {
      queue.push(rawOffers);
    }

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || typeof current !== 'object') {
        continue;
      }

      const offer = current as JsonObject;

      const nestedOffers = offer['offers'];
      if (Array.isArray(nestedOffers)) {
        queue.push(...nestedOffers);
      } else if (nestedOffers) {
        queue.push(nestedOffers);
      }

      const priceCandidates: Array<{
        value: unknown;
        currency?: unknown;
      }> = [];

      const specCandidates = this.normalizeObjectArray(offer['priceSpecification']);
      for (const spec of specCandidates) {
        priceCandidates.push({ value: spec['price'], currency: spec['priceCurrency'] });
        priceCandidates.push({ value: spec['minPrice'], currency: spec['priceCurrency'] });
        priceCandidates.push({ value: spec['maxPrice'], currency: spec['priceCurrency'] });
      }

      priceCandidates.push({ value: offer['price'], currency: offer['priceCurrency'] });
      priceCandidates.push({ value: offer['lowPrice'], currency: offer['priceCurrency'] });
      priceCandidates.push({ value: offer['highPrice'], currency: offer['priceCurrency'] });

      const availabilitySource = offer['availability'] ?? offer['itemCondition'] ?? '';
      const availabilityText = typeof availabilitySource === 'string' ? availabilitySource : '';
      const available = availabilityText ? !isOutOfStock(availabilityText) : true;

      for (const candidate of priceCandidates) {
        if (candidate.value == null) {
          continue;
        }

        const numericPrice = this.parsePriceCandidate(candidate.value);
        if (!numericPrice) {
          continue;
        }

        const currency = this.resolveCurrency(candidate.currency, candidate.value);

        candidates.push({
          price: numericPrice,
          currency,
          available,
        });
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    const preferred = candidates.find(candidate => candidate.price >= 10) ?? candidates[0];
    return preferred;
  }

  private normalizeImageSource(image: unknown): string | undefined {
    if (!image) return undefined;

    if (Array.isArray(image)) {
      for (const item of image) {
        const normalized = this.normalizeImageSource(item);
        if (normalized) {
          return normalized;
        }
      }
      return undefined;
    }

    if (typeof image !== 'string') {
      return undefined;
    }

    const trimmed = image.trim();
    if (!trimmed) {
      return undefined;
    }

    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`;
    }

    return trimmed;
  }

  private asJsonObject(value: unknown): JsonObject | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as JsonObject;
    }
    return null;
  }

  private normalizeObjectArray(value: unknown): JsonObject[] {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value.map(item => this.asJsonObject(item)).filter((item): item is JsonObject => Boolean(item));
    }

    const single = this.asJsonObject(value);
    return single ? [single] : [];
  }

  private parsePriceCandidate(value: unknown): number | null {
    if (typeof value === 'number') {
      return value > 0 ? value : null;
    }

    if (typeof value === 'string') {
      const parsed = parsePrice(value);
      return parsed > 0 ? parsed : null;
    }

    return null;
  }

  private resolveCurrency(candidateCurrency: unknown, priceSource: unknown): string {
    if (typeof candidateCurrency === 'string' && candidateCurrency.trim().length > 0) {
      return candidateCurrency.trim();
    }

    if (typeof priceSource === 'string') {
      return detectCurrency(priceSource);
    }

    return 'EUR';
  }

  private extractDigits(text: string | null | undefined): string {
    if (!text) return '';
    return text.replace(/[^\d]/g, '');
  }
}
