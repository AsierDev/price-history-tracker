/**
 * Chrome Storage Local wrapper for persistent data
 * Uses individual keys per product to avoid quota limits
 * Structure:
 * - config: ExtensionConfig
 * - anonymousUserId: string
 * - lastCheckTime: number
 * - product_${id}: TrackedProduct (one key per product)
 * - rateLimit_${domain}: RateLimitBucket (one key per domain)
 */

import type { StorageData, TrackedProduct, ExtensionConfig, RateLimitBucket } from './types';
import { logger } from '../utils/logger';
import { ENV } from '../config/env';
import { PERCENTAGES, LIMITS, STORAGE_KEYS } from '../shared/constants';

function filterUndefinedValues<T extends object>(obj: T): T {
  const cleaned = Object.entries(obj).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});
  return cleaned as T;
}

// Storage key prefixes
const KEYS = {
  CONFIG: 'config',
  ANONYMOUS_USER_ID: 'anonymousUserId',
  LAST_CHECK_TIME: 'lastCheckTime',
  PRODUCT_PREFIX: 'product_',
  RATE_LIMIT_PREFIX: 'rateLimit_',
} as const;

const productKey = (id: string) => `${KEYS.PRODUCT_PREFIX}${id}`;

const DEFAULT_CONFIG: ExtensionConfig = {
  checkIntervalHours: 6,
  maxProductsTracked: LIMITS.MAX_PRODUCTS,
  priceDropThreshold: PERCENTAGES.PRICE_DROP_THRESHOLD,
  serialMode: true,
  notificationsEnabled: true,
  affiliateIds: {
    amazon: ENV.AFFILIATE_AMAZON_TAG,
    ebay: ENV.AFFILIATE_EBAY_ID,
    aliexpress: ENV.AFFILIATE_ADMITAD_ID,
  },
};

const DEFAULT_STORAGE_DATA: StorageData = {
  products: [],
  rateLimitBuckets: {},
  config: DEFAULT_CONFIG,
  lastCheckTime: 0,
};

function sanitizeProduct(product: TrackedProduct): TrackedProduct {
  return filterUndefinedValues(product);
}

export class StorageManager {
  /**
   * Get all data from storage (legacy compatibility method)
   * @deprecated Use specific getters instead (getProducts, getConfig, etc.)
   */
  static async getData(): Promise<StorageData> {
    try {
      const [products, config, lastCheckTime, anonymousUserId, rateLimitBuckets] = await Promise.all([
        this.getProducts(),
        this.getConfig(),
        this.getLastCheckTime(),
        this.getAnonymousUserId(),
        this.getAllRateLimitBuckets(),
      ]);

      return {
        products,
        rateLimitBuckets,
        config,
        lastCheckTime,
        anonymousUserId,
      };
    } catch (error) {
      logger.error('Failed to get storage data', error);
      return DEFAULT_STORAGE_DATA;
    }
  }

  /**
   * Save all data to storage (legacy compatibility method)
   * @deprecated Use specific setters instead
   */
  static async setData(data: StorageData): Promise<void> {
    try {
      // Save config and metadata
      await chrome.storage.local.set({
        [KEYS.CONFIG]: data.config,
        [KEYS.LAST_CHECK_TIME]: data.lastCheckTime,
        [KEYS.ANONYMOUS_USER_ID]: data.anonymousUserId,
      });

      // Save products individually
      const productUpdates: Record<string, TrackedProduct> = {};
      for (const product of data.products) {
        productUpdates[productKey(product.id)] = sanitizeProduct(product);
      }
      await chrome.storage.local.set(productUpdates);

      // Save rate limit buckets individually
      const rateLimitUpdates: Record<string, RateLimitBucket> = {};
      for (const [domain, bucket] of Object.entries(data.rateLimitBuckets)) {
        rateLimitUpdates[`${KEYS.RATE_LIMIT_PREFIX}${domain}`] = bucket;
      }
      await chrome.storage.local.set(rateLimitUpdates);

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
    try {
      const allData = await chrome.storage.local.get(null);
      const products: TrackedProduct[] = [];

      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith(KEYS.PRODUCT_PREFIX)) {
          products.push(sanitizeProduct(value as TrackedProduct));
        }
      }

      return products;
    } catch (error) {
      logger.error('Failed to get products', error);
      return [];
    }
  }

  /**
   * Get single product by id
   */
  static async getProductById(productId: string): Promise<TrackedProduct | undefined> {
    try {
      const key = productKey(productId);
      const result = await chrome.storage.local.get(key);
      const product = result[key] as TrackedProduct | undefined;
      return product ? sanitizeProduct(product) : undefined;
    } catch (error) {
      logger.error('Failed to get product by id', error, { productId });
      return undefined;
    }
  }

  /**
   * Add a new product
   */
  static async addProduct(product: TrackedProduct): Promise<void> {
    try {
      const products = await this.getProducts();
      const config = await this.getConfig();

      if (products.length >= config.maxProductsTracked) {
        throw new Error(`Maximum ${config.maxProductsTracked} products tracked`);
      }

      // Check for duplicates
      const exists = products.some(p => p.url === product.url);
      if (exists) {
        throw new Error('Product already tracked');
      }

      // Save product with individual key (no priceHistory, no imageUrl)
      await chrome.storage.local.set({
        [productKey(product.id)]: sanitizeProduct(product),
      });

      logger.info('Product added', { productId: product.id, title: product.title });
    } catch (error) {
      logger.error('Failed to add product', error);
      throw error;
    }
  }

  /**
   * Update an existing product
   */
  static async updateProduct(productId: string, updates: Partial<TrackedProduct>): Promise<void> {
    try {
      await this.updateProductById(productId, updates);
    } catch (error) {
      logger.error('Failed to update product', error);
      throw error;
    }
  }

  /**
   * Update product by id (filters undefined values)
   */
  static async updateProductById(productId: string, updates: Partial<TrackedProduct>): Promise<void> {
    const key = productKey(productId);
    const result = await chrome.storage.local.get(key);
    const product = result[key] as TrackedProduct | undefined;

    if (!product) {
      throw new Error('Product not found');
    }

    const updatedProduct = sanitizeProduct({
      ...product,
      ...filterUndefinedValues(updates as Record<string, unknown>),
    } as TrackedProduct);

    await chrome.storage.local.set({ [key]: updatedProduct });
    logger.debug('Product updated', { productId });
  }

  /**
   * Remove a product
   */
  static async removeProduct(productId: string): Promise<void> {
    try {
      const key = `${KEYS.PRODUCT_PREFIX}${productId}`;
      await chrome.storage.local.remove(key);
      logger.info('Product removed', { productId });
    } catch (error) {
      logger.error('Failed to remove product', error);
      throw error;
    }
  }

  /**
   * Get all rate limit buckets
   */
  static async getAllRateLimitBuckets(): Promise<Record<string, RateLimitBucket>> {
    try {
      const allData = await chrome.storage.local.get(null);
      const buckets: Record<string, RateLimitBucket> = {};

      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith(KEYS.RATE_LIMIT_PREFIX)) {
          const domain = key.replace(KEYS.RATE_LIMIT_PREFIX, '');
          buckets[domain] = value as RateLimitBucket;
        }
      }

      return buckets;
    } catch (error) {
      logger.error('Failed to get rate limit buckets', error);
      return {};
    }
  }

  /**
   * Get rate limit bucket for a domain
   */
  static async getRateLimitBucket(domain: string): Promise<RateLimitBucket | undefined> {
    try {
      const key = `${KEYS.RATE_LIMIT_PREFIX}${domain}`;
      const result = await chrome.storage.local.get(key);
      return result[key] as RateLimitBucket | undefined;
    } catch (error) {
      logger.error('Failed to get rate limit bucket', error);
      return undefined;
    }
  }

  /**
   * Update rate limit bucket
   */
  static async updateRateLimitBucket(bucket: RateLimitBucket): Promise<void> {
    try {
      const key = `${KEYS.RATE_LIMIT_PREFIX}${bucket.domain}`;
      await chrome.storage.local.set({ [key]: bucket });
      logger.debug('Rate limit bucket updated', { domain: bucket.domain });
    } catch (error) {
      logger.error('Failed to update rate limit bucket', error);
      throw error;
    }
  }

  /**
   * Clear rate limit for a domain
   */
  static async clearRateLimitBucket(domain: string): Promise<void> {
    try {
      const key = `${KEYS.RATE_LIMIT_PREFIX}${domain}`;
      await chrome.storage.local.remove(key);
      logger.debug('Rate limit bucket cleared', { domain });
    } catch (error) {
      logger.error('Failed to clear rate limit bucket', error);
    }
  }

  /**
   * Clear all rate limit buckets
   */
  static async clearAllRateLimitBuckets(): Promise<void> {
    try {
      const allData = await chrome.storage.local.get(null);
      const keysToRemove: string[] = [];

      for (const key of Object.keys(allData)) {
        if (key.startsWith(KEYS.RATE_LIMIT_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }

      logger.debug('All rate limit buckets cleared');
    } catch (error) {
      logger.error('Failed to clear all rate limit buckets', error);
    }
  }

  /**
   * Get extension configuration
   */
  static async getConfig(): Promise<ExtensionConfig> {
    try {
      const result = await chrome.storage.local.get(KEYS.CONFIG);
      const config = result[KEYS.CONFIG] as ExtensionConfig | undefined;

      if (!config) {
        // Initialize with defaults
        await chrome.storage.local.set({ [KEYS.CONFIG]: DEFAULT_CONFIG });
        return DEFAULT_CONFIG;
      }

      // Merge with defaults to handle missing fields
      return { ...DEFAULT_CONFIG, ...config };
    } catch (error) {
      logger.error('Failed to get config', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Update extension configuration
   */
  static async updateConfig(updates: Partial<ExtensionConfig>): Promise<void> {
    try {
      const config = await this.getConfig();
      const updatedConfig = { ...config, ...updates };
      await chrome.storage.local.set({ [KEYS.CONFIG]: updatedConfig });
      logger.info('Config updated');
    } catch (error) {
      logger.error('Failed to update config', error);
      throw error;
    }
  }

  /**
   * Get last check time
   */
  static async getLastCheckTime(): Promise<number> {
    try {
      const result = await chrome.storage.local.get(KEYS.LAST_CHECK_TIME);
      return result[KEYS.LAST_CHECK_TIME] || 0;
    } catch (error) {
      logger.error('Failed to get last check time', error);
      return 0;
    }
  }

  /**
   * Update last check time
   */
  static async updateLastCheckTime(timestamp: number): Promise<void> {
    try {
      await chrome.storage.local.set({ [KEYS.LAST_CHECK_TIME]: timestamp });
    } catch (error) {
      logger.error('Failed to update last check time', error);
    }
  }

  /**
   * Get anonymous user ID (Firebase Auth)
   */
  static async getAnonymousUserId(): Promise<string | undefined> {
    try {
      const result = await chrome.storage.local.get(KEYS.ANONYMOUS_USER_ID);
      return result[KEYS.ANONYMOUS_USER_ID] as string | undefined;
    } catch (error) {
      logger.error('Failed to get anonymous user ID', error);
      return undefined;
    }
  }

  /**
   * Set anonymous user ID (Firebase Auth)
   */
  static async setAnonymousUserId(userId: string): Promise<void> {
    try {
      await chrome.storage.local.set({ [KEYS.ANONYMOUS_USER_ID]: userId });
      logger.info('Anonymous user ID saved', { userId });
    } catch (error) {
      logger.error('Failed to set anonymous user ID', error);
      throw error;
    }
  }

  /**
   * Trim all products' price histories (deprecated - history moved to backend)
   * @deprecated Price history is now stored in Firebase, not locally
   */
  static async trimAllPriceHistories(): Promise<void> {
    logger.info('trimAllPriceHistories is deprecated - price history moved to backend');
    // No-op: price history is no longer stored locally
  }

  /**
   * Migrate legacy aggregated storage format into per-product records
   */
  static async migrateLegacyFormat(): Promise<void> {
    try {
      const legacyKey = STORAGE_KEYS.PRICE_TRACKER_DATA;
      const legacyPayload = await chrome.storage.local.get(legacyKey);
      const legacyData = legacyPayload[legacyKey] as StorageData | undefined;
      if (!legacyData?.products?.length) {
        return;
      }

      logger.info('Migrating legacy storage format', {
        products: legacyData.products.length,
      });

      for (const legacyProduct of legacyData.products) {
        const {
          priceHistory,
          imageUrl,
          ...rest
        } = legacyProduct as TrackedProduct & { priceHistory?: unknown; imageUrl?: unknown };

        void priceHistory;
        void imageUrl;

        const sanitized = sanitizeProduct(rest as TrackedProduct);
        await chrome.storage.local.set({ [productKey(sanitized.id)]: sanitized });
      }

      await chrome.storage.local.remove(legacyKey);
      logger.info('Legacy storage migration completed');
    } catch (error) {
      logger.error('Failed to migrate legacy storage format', error);
    }
  }

  /**
   * Clear all data (for testing/reset)
   */
  static async clearAll(): Promise<void> {
    try {
      await chrome.storage.local.clear();
      logger.warn('All storage data cleared');
    } catch (error) {
      logger.error('Failed to clear all storage', error);
      throw error;
    }
  }
}
