/**
 * Test helpers and mock utilities for Price History Tracker tests
 */

import { vi } from 'vitest';
import type { TrackedProduct, ExtractedProductData } from '@core/types';

/**
 * Create a mock TrackedProduct for testing
 */
export function createMockProduct(overrides: Partial<TrackedProduct> = {}): TrackedProduct {
  return {
    id: 'test-product-id',
    url: 'https://amazon.es/dp/B06XGW29XJ',
    title: 'Test Product',
    currentPrice: 29.99,
    initialPrice: 29.99,
    currency: 'EUR',
    adapter: 'amazon',
    addedAt: Date.now(),
    lastCheckedAt: Date.now() - 3600000, // 1 hour ago
    isActive: true,
    ...overrides,
  };
}

/**
 * Create mock HTML for adapter testing
 */
export function createMockHTML(options: {
  title?: string;
  price?: string;
  currency?: string;
  available?: boolean;
  availabilityText?: string;
  imageUrl?: string;
}): string {
  const {
    title = 'Test Product Title',
    price = '29,99',
    currency = 'EUR',
    available = true,
    availabilityText = available ? '' : 'Currently unavailable',
    imageUrl,
  } = options;

  const currencySymbol = currency === 'EUR' ? '€' : '$';
  const priceText = `${price}${currencySymbol}`;

  return `
    <!DOCTYPE html>
    <html>
    <head><title>Test Page</title></head>
    <body>
      <div id="productTitle">${title}</div>
      <span class="a-price-whole">${priceText}</span>
      ${availabilityText ? `<span id="availability">${availabilityText}</span>` : ''}
      ${imageUrl ? `<img id="landingImage" src="${imageUrl}" />` : ''}
    </body>
    </html>
  `;
}

/**
 * Create mock ExtractedProductData for testing
 */
export function createMockExtractedData(overrides: Partial<ExtractedProductData> = {}): ExtractedProductData {
  return {
    title: 'Test Product',
    price: 29.99,
    currency: 'EUR',
    available: true,
    ...overrides,
  };
}

/**
 * Generate a random product ID for testing
 */
export function generateTestId(): string {
  return `test-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Mock Chrome storage API for testing
 */
export class MockChromeStorage {
  private storage: Record<string, unknown> = {};

  get = vi.fn<(_keys: string[] | string | null) => Promise<Record<string, unknown>>>().mockImplementation((_keys) => {
    if (_keys === null) {
      return Promise.resolve(this.storage);
    }

    if (typeof _keys === 'string') {
      return Promise.resolve({ [_keys]: this.storage[_keys] });
    }

    const result: Record<string, unknown> = {};
    for (const key of _keys) {
      if (key in this.storage) {
        result[key] = this.storage[key];
      }
    }
    return Promise.resolve(result);
  });

  set = vi.fn<(_data: Record<string, unknown>) => Promise<void>>().mockImplementation((_data) => {
    Object.assign(this.storage, _data);
    return Promise.resolve();
  });

  remove = vi.fn<(_keys: string | string[]) => Promise<void>>().mockImplementation((_keys) => {
    const keyArray = Array.isArray(_keys) ? _keys : [_keys];
    for (const key of keyArray) {
      delete this.storage[key];
    }
    return Promise.resolve();
  });

  clear = vi.fn<() => Promise<void>>().mockImplementation(() => {
    this.storage = {};
    return Promise.resolve();
  });

  getStorage() {
    return this.storage;
  }

  reset() {
    this.storage = {};
    this.get.mockClear();
    this.set.mockClear();
    this.remove.mockClear();
    this.clear.mockClear();
  }
}
