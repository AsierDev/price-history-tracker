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
import { genericAdapter } from './implementations/generic.adapter';
import { logger } from '../utils/logger';

// Registry of specific adapters (priority order)
const specificAdapters: PriceAdapter[] = [
  new AmazonAdapter(),
  new EbayAdapter(),
  new AliExpressAdapter(),
  new TradeTrackerAdapter(),
  new BelboonAdapter(),
  new AwinAdapter(),
];

// All adapters including generic fallback
const adapters: PriceAdapter[] = [...specificAdapters, genericAdapter];

/**
 * Get the appropriate adapter for a given URL
 * Tries specific adapters first, then falls back to generic adapter
 */
export function getAdapterForUrl(url: string): PriceAdapter {
  // Try specific adapters first
  for (const adapter of specificAdapters) {
    if (adapter.enabled && adapter.canHandle(url)) {
      logger.debug('Specific adapter found for URL', {
        adapter: adapter.name,
        url,
      });
      return adapter;
    }
  }

  // Fallback to generic adapter
  logger.debug('Using generic adapter as fallback', { url });
  return genericAdapter;
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
 * Check if a URL is supported by any specific adapter (not generic)
 */
export function isUrlSupported(url: string): boolean {
  return specificAdapters.some(adapter => adapter.enabled && adapter.canHandle(url));
}

/**
 * Check if a URL requires manual price selection (uses generic adapter)
 * Returns true only if NO specific adapter is found AND generic adapter is needed
 */
export function requiresManualSelection(url: string): boolean {
  // Check if there's a specific adapter for this URL
  const hasSpecificAdapter = specificAdapters.some(adapter => adapter.enabled && adapter.canHandle(url));
  
  // Manual selection is needed only if there's NO specific adapter
  // (meaning we'll use the generic adapter)
  return !hasSpecificAdapter;
}
