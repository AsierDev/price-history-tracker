/**
 * Price checking orchestrator with serial execution and rate limiting
 */

import type { TrackedProduct, NotificationData } from './types';
import { StorageManager } from './storage';
import { RateLimiter } from './rateLimiter';
import { NotificationManager } from './notificationManager';
import { getAdapterForUrl } from '@adapters/registry';
import { getCurrentTimestamp } from '@utils/dateUtils';
import { logger } from '@utils/logger';
import { LIMITS } from '../shared/constants';

export class PriceChecker {
  /**
   * Check all active products (serial execution)
   */
  static async checkAllProducts(): Promise<void> {
    logger.info('Starting price check for all products');
    const startTime = getCurrentTimestamp();

    try {
      const products = await StorageManager.getProducts();
      const activeProducts = products.filter(p => p.isActive);

      logger.info(`Checking ${activeProducts.length} active products`);

      let successCount = 0;
      let failureCount = 0;
      let skippedCount = 0;

      // Serial execution: 1 product per second
      for (const product of activeProducts) {
        try {
          // Check rate limit
          const isLimited = await RateLimiter.isRateLimited(product.url);
          if (isLimited) {
            const minutes = await RateLimiter.getMinutesUntilRetry(product.url);
            logger.debug('Product skipped due to rate limit', {
              productId: product.id,
              minutesUntilRetry: minutes,
            });
            skippedCount++;
            continue;
          }

          // Check price
          const result = await this.checkProduct(product);
          
          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }

          // Wait 1 second between requests (serial mode)
          await this.sleep(1000);
        } catch (error) {
          logger.error('Error checking product', error, {
            productId: product.id,
            url: product.url,
          });
          failureCount++;
        }
      }

      // Update last check time
      await StorageManager.updateLastCheckTime(getCurrentTimestamp());

      const duration = getCurrentTimestamp() - startTime;
      logger.info('Price check completed', {
        total: activeProducts.length,
        success: successCount,
        failed: failureCount,
        skipped: skippedCount,
        durationMs: duration,
      });
    } catch (error) {
      logger.error('Failed to check products', error);
    }
  }

  /**
   * Check a single product
   */
  static async checkProduct(product: TrackedProduct): Promise<{ success: boolean }> {
    try {
      logger.debug('Checking product', {
        productId: product.id,
        url: product.url,
        adapter: product.adapter,
      });

      // Get adapter
      const adapter = getAdapterForUrl(product.url);
      if (!adapter || !adapter.enabled) {
        logger.warn('No adapter available for product', {
          productId: product.id,
          url: product.url,
        });
        return { success: false };
      }

      // Fetch product page
      const response = await fetch(product.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Extract data
      const data = await adapter.extractData(html);

      if (!data.available) {
        logger.warn('Product not available', {
          productId: product.id,
          error: data.error,
        });
        await RateLimiter.recordFailure(product.url, data.error || 'Product unavailable');
        return { success: false };
      }

      // Record success
      await RateLimiter.recordSuccess(product.url);

      // Update product
      const newPrice = data.price;
      const priceChanged = Math.abs(newPrice - product.currentPrice) > 0.01;

      if (priceChanged) {
        await this.handlePriceChange(product, newPrice);
      }

      // Always add entry to price history (even if price unchanged)
      const newHistoryEntry = {
        price: newPrice,
        timestamp: getCurrentTimestamp(),
        checkedAt: getCurrentTimestamp(),
      };

      const updatedHistory = [
        ...product.priceHistory,
        newHistoryEntry,
      ].slice(-LIMITS.MAX_HISTORY_ENTRIES); // keep max entries

      await StorageManager.updateProduct(product.id, {
        lastCheckedAt: getCurrentTimestamp(),
        priceHistory: updatedHistory,
        // Only update currentPrice when it changed significantly
        ...(priceChanged ? { currentPrice: newPrice } : {}),
      });

      logger.debug('Product checked successfully', {
        productId: product.id,
        oldPrice: product.currentPrice,
        newPrice,
        priceChanged,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to check product', error, {
        productId: product.id,
        url: product.url,
      });

      // Record failure for rate limiting
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await RateLimiter.recordFailure(product.url, errorMessage);

      return { success: false };
    }
  }

  /**
   * Handle price change (update storage and notify if needed)
   */
  private static async handlePriceChange(
    product: TrackedProduct,
    newPrice: number
  ): Promise<void> {
    const oldPrice = product.currentPrice;
    const priceDiff = oldPrice - newPrice;
    const percentChange = (priceDiff / oldPrice) * 100;

    logger.info('Price changed', {
      productId: product.id,
      oldPrice,
      newPrice,
      percentChange: percentChange.toFixed(2),
    });

    // Check if we should notify (price drop > threshold)
    const config = await StorageManager.getConfig();
    if (percentChange >= config.priceDropThreshold) {
      const notificationData: NotificationData = {
        productId: product.id,
        title: product.title,
        oldPrice,
        newPrice,
        percentDrop: percentChange,
        url: product.url,
      };

      await NotificationManager.notifyPriceDrop(notificationData);
    }
  }

  /**
   * Sleep utility for serial execution
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
