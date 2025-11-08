/**
 * Adapter registry - Factory pattern for adapter discovery
 */

import type { PriceAdapter } from './types';
import { AmazonAdapter } from './implementations/amazon.adapter';
import { EbayAdapter } from './implementations/ebay.adapter';
import { AliExpressAdapter } from './implementations/aliexpress.adapter';
import { TradeTrackerAdapter } from './implementations/tradetracker.adapter';
import { BelboonAdapter } from './implementations/belboon.adapter';
import { AwinAdapter } from './implementations/awin.adapter';
import { logger } from '../utils/logger';

// Registry of all adapters
const adapters: PriceAdapter[] = [
  new AmazonAdapter(),
  new EbayAdapter(),
  new AliExpressAdapter(),
  new TradeTrackerAdapter(),
  new BelboonAdapter(),
  new AwinAdapter(),
];

/**
 * Get the appropriate adapter for a given URL
 */
export function getAdapterForUrl(url: string): PriceAdapter | null {
  for (const adapter of adapters) {
    if (adapter.enabled && adapter.canHandle(url)) {
      logger.debug('Adapter found for URL', {
        adapter: adapter.name,
        url,
      });
      return adapter;
    }
  }

  logger.warn('No adapter found for URL', { url });
  return null;
}

/**
 * Get all enabled adapters
 */
export function getEnabledAdapters(): PriceAdapter[] {
  return adapters.filter(a => a.enabled);
}

/**
 * Get all adapters (including disabled)
 */
export function getAllAdapters(): PriceAdapter[] {
  return adapters;
}

/**
 * Check if a URL is supported by any adapter
 */
export function isUrlSupported(url: string): boolean {
  return adapters.some(adapter => adapter.enabled && adapter.canHandle(url));
}
