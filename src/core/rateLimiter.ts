/**
 * Rate limiting with exponential backoff per domain
 * Prevents getting banned by e-commerce sites
 */

import type { RateLimitBucket } from './types';
import { StorageManager } from './storage';
import { getCurrentTimestamp, addMinutes, isExpired } from '../utils/dateUtils';
import { extractDomain } from '../utils/urlUtils';
import { logger } from '../utils/logger';

// Backoff progression: 1min → 5min → 30min → 2h
const BACKOFF_LEVELS = [1, 5, 30, 120];
const MAX_BACKOFF_LEVEL = BACKOFF_LEVELS.length - 1;

export class RateLimiter {
  /**
   * Check if a domain is currently rate limited
   */
  static async isRateLimited(url: string): Promise<boolean> {
    const domain = extractDomain(url);
    if (!domain) return false;

    const bucket = await StorageManager.getRateLimitBucket(domain);
    if (!bucket) return false;

    const limited = !isExpired(bucket.nextRetryAt);
    
    if (limited) {
      logger.debug('Domain is rate limited', {
        domain,
        nextRetryAt: bucket.nextRetryAt,
        failureCount: bucket.failureCount,
      });
    }

    return limited;
  }

  /**
   * Record a successful request (clears rate limit)
   */
  static async recordSuccess(url: string): Promise<void> {
    const domain = extractDomain(url);
    if (!domain) return;

    const bucket = await StorageManager.getRateLimitBucket(domain);
    if (bucket) {
      await StorageManager.clearRateLimitBucket(domain);
      logger.debug('Rate limit cleared for domain', { domain });
    }
  }

  /**
   * Record a failed request (applies backoff)
   */
  static async recordFailure(url: string, error: string): Promise<void> {
    const domain = extractDomain(url);
    if (!domain) return;

    const bucket = await StorageManager.getRateLimitBucket(domain);
    const currentTime = getCurrentTimestamp();

    let newBucket: RateLimitBucket;

    if (!bucket) {
      // First failure: 1 minute backoff
      newBucket = {
        domain,
        failureCount: 1,
        backoffMinutes: BACKOFF_LEVELS[0],
        nextRetryAt: addMinutes(currentTime, BACKOFF_LEVELS[0]),
      };
    } else {
      // Subsequent failures: exponential backoff
      const nextLevel = Math.min(bucket.failureCount, MAX_BACKOFF_LEVEL);
      const backoffMinutes = BACKOFF_LEVELS[nextLevel];
      
      newBucket = {
        domain,
        failureCount: bucket.failureCount + 1,
        backoffMinutes,
        nextRetryAt: addMinutes(currentTime, backoffMinutes),
      };
    }

    await StorageManager.updateRateLimitBucket(newBucket);
    
    logger.warn('Rate limit applied to domain', {
      domain,
      failureCount: newBucket.failureCount,
      backoffMinutes: newBucket.backoffMinutes,
      error,
    });
  }

  /**
   * Get time until next retry for a domain (in minutes)
   */
  static async getMinutesUntilRetry(url: string): Promise<number> {
    const domain = extractDomain(url);
    if (!domain) return 0;

    const bucket = await StorageManager.getRateLimitBucket(domain);
    if (!bucket) return 0;

    const now = getCurrentTimestamp();
    const diff = bucket.nextRetryAt - now;
    return Math.max(0, Math.ceil(diff / (60 * 1000)));
  }

  /**
   * Manually clear rate limit for a domain (admin function)
   */
  static async clearDomain(url: string): Promise<void> {
    const domain = extractDomain(url);
    if (!domain) return;

    await StorageManager.clearRateLimitBucket(domain);
    logger.info('Rate limit manually cleared', { domain });
  }

  /**
   * Clear all rate limit buckets (for testing)
   */
  static async clearAllBuckets(): Promise<void> {
    await StorageManager.clearAllRateLimitBuckets();
    logger.info('All rate limit buckets cleared');
  }
}
