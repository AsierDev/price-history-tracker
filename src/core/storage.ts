/**
 * Chrome Storage Sync wrapper for persistent data
 */

import type { StorageData, TrackedProduct, ExtensionConfig, RateLimitBucket } from './types';
import { logger } from '../utils/logger';
import { PERCENTAGES, LIMITS } from '../shared/constants';

const STORAGE_KEY = 'priceTrackerData';

const DEFAULT_CONFIG: ExtensionConfig = {
  checkIntervalHours: 6,
  maxProductsTracked: LIMITS.MAX_PRODUCTS,
  priceDropThreshold: PERCENTAGES.PRICE_DROP_THRESHOLD,
  serialMode: true,
  affiliateIds: {
    amazon: process.env.AFFILIATE_AMAZON_TAG || '',
    ebay: process.env.AFFILIATE_EBAY_ID || '',
    aliexpress: process.env.AFFILIATE_ADMITAD_ID || '',
  },
};

const DEFAULT_STORAGE_DATA: StorageData = {
  products: [],
  rateLimitBuckets: {},
  config: DEFAULT_CONFIG,
  lastCheckTime: 0,
};

export class StorageManager {
  /**
   * Get all data from storage
   */
  static async getData(): Promise<StorageData> {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      const data = result[STORAGE_KEY] as StorageData | undefined;
      
      if (!data) {
        logger.info('No storage data found, initializing with defaults');
        await this.setData(DEFAULT_STORAGE_DATA);
        return DEFAULT_STORAGE_DATA;
      }

      // Merge with defaults to handle missing fields
      return {
        ...DEFAULT_STORAGE_DATA,
        ...data,
        config: { ...DEFAULT_CONFIG, ...data.config },
      };
    } catch (error) {
      logger.error('Failed to get storage data', error);
      return DEFAULT_STORAGE_DATA;
    }
  }

  /**
   * Save all data to storage
   */
  static async setData(data: StorageData): Promise<void> {
    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: data });
      logger.debug('Storage data saved successfully');
    } catch (error) {
      logger.error('Failed to save storage data', error);
      throw error;
    }
  }

  /**
   * Get all tracked products
   */
  static async getProducts(): Promise<TrackedProduct[]> {
    const data = await this.getData();
    return data.products;
  }

  /**
   * Add a new product
   */
  static async addProduct(product: TrackedProduct): Promise<void> {
    const data = await this.getData();
    
    if (data.products.length >= data.config.maxProductsTracked) {
      throw new Error(`Maximum ${data.config.maxProductsTracked} products tracked`);
    }

    // Check for duplicates
    const exists = data.products.some(p => p.url === product.url);
    if (exists) {
      throw new Error('Product already tracked');
    }

    data.products.push(product);
    await this.setData(data);
    logger.info('Product added', { productId: product.id, title: product.title });
  }

  /**
   * Update an existing product
   */
  static async updateProduct(productId: string, updates: Partial<TrackedProduct>): Promise<void> {
    const data = await this.getData();
    const index = data.products.findIndex(p => p.id === productId);

    if (index === -1) {
      throw new Error('Product not found');
    }

    // If updating price history, trim it to prevent quota issues
    if (updates.priceHistory) {
      updates.priceHistory = updates.priceHistory.slice(-LIMITS.MAX_HISTORY_ENTRIES);
    }

    data.products[index] = { ...data.products[index], ...updates };
    await this.setData(data);
    logger.debug('Product updated', { productId });
  }

  /**
   * Remove a product
   */
  static async removeProduct(productId: string): Promise<void> {
    const data = await this.getData();
    data.products = data.products.filter(p => p.id !== productId);
    await this.setData(data);
    logger.info('Product removed', { productId });
  }

  /**
   * Get rate limit bucket for a domain
   */
  static async getRateLimitBucket(domain: string): Promise<RateLimitBucket | undefined> {
    const data = await this.getData();
    return data.rateLimitBuckets[domain];
  }

  /**
   * Update rate limit bucket
   */
  static async updateRateLimitBucket(bucket: RateLimitBucket): Promise<void> {
    const data = await this.getData();
    data.rateLimitBuckets[bucket.domain] = bucket;
    await this.setData(data);
    logger.debug('Rate limit bucket updated', { domain: bucket.domain });
  }

  /**
   * Clear rate limit for a domain
   */
  static async clearRateLimitBucket(domain: string): Promise<void> {
    const data = await this.getData();
    if (data.rateLimitBuckets[domain]) {
      delete data.rateLimitBuckets[domain];
      await this.setData(data);
    }
    logger.debug('Rate limit bucket cleared', { domain });
  }

  /**
   * Clear all rate limit buckets
   */
  static async clearAllRateLimitBuckets(): Promise<void> {
    const data = await this.getData();
    data.rateLimitBuckets = {};
    await this.setData(data);
    logger.debug('All rate limit buckets cleared');
  }

  /**
   * Get extension configuration
   */
  static async getConfig(): Promise<ExtensionConfig> {
    const data = await this.getData();
    return data.config;
  }

  /**
   * Update extension configuration
   */
  static async updateConfig(updates: Partial<ExtensionConfig>): Promise<void> {
    const data = await this.getData();
    data.config = { ...data.config, ...updates };
    await this.setData(data);
    logger.info('Config updated');
  }

  /**
   * Update last check time
   */
  static async updateLastCheckTime(timestamp: number): Promise<void> {
    const data = await this.getData();
    data.lastCheckTime = timestamp;
    await this.setData(data);
  }

  /**
   * Trim all products' price histories to prevent quota issues
   */
  static async trimAllPriceHistories(): Promise<void> {
    const data = await this.getData();
    let trimmedCount = 0;

    for (const product of data.products) {
      if (product.priceHistory.length > LIMITS.MAX_HISTORY_ENTRIES) {
        product.priceHistory = product.priceHistory.slice(-LIMITS.MAX_HISTORY_ENTRIES);
        trimmedCount++;
        logger.debug('Trimmed price history', {
          productId: product.id,
          originalLength: product.priceHistory.length,
          newLength: LIMITS.MAX_HISTORY_ENTRIES,
        });
      }
    }

    if (trimmedCount > 0) {
      await this.setData(data);
      logger.info('Trimmed price histories', { productsTrimmed: trimmedCount });
    }
  }

  /**
   * Clear all data (for testing/reset)
   */
  static async clearAll(): Promise<void> {
    await chrome.storage.sync.remove(STORAGE_KEY);
    logger.warn('All storage data cleared');
  }
}
