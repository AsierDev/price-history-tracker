/**
 * Service Worker - Background orchestration for price checking
 */

import type { TrackedProduct, ExtractedProductData } from './core/types';
import { StorageManager } from './core/storage';
import { PriceChecker } from './core/priceChecker';
import { RateLimiter } from './core/rateLimiter';
import { NotificationManager } from './core/notificationManager';
import { getAdapterForUrl } from './adapters/registry';
import { getCurrentTimestamp } from './utils/dateUtils';
import { normalizeUrl } from './utils/urlUtils';
import { logger } from './utils/logger';
import { addPriceToBackend } from './backend/backend';

const ALARM_NAME = 'checkPrices';
const CHECK_INTERVAL_MINUTES = 360; // 6 hours

// Track if popup is open to avoid unnecessary checks
let isPopupOpen = false;

/**
 * Extension installed/updated
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info('Extension installed/updated', { reason: details.reason });

  try {
    // Initialize storage
    await StorageManager.getData();

    // Setup notification handlers
    NotificationManager.setupNotificationHandlers();

    // Trim oversized price histories to prevent quota issues
    await StorageManager.trimAllPriceHistories();

    // Create alarm for price checking
    await chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 1, // First check after 1 minute
      periodInMinutes: CHECK_INTERVAL_MINUTES,
    });

    logger.info('Service worker initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize service worker', error);
  }
});

/**
 * Alarm triggered (price check)
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    // Skip automatic checks if popup is open (user can manually refresh)
    if (!isPopupOpen) {
      logger.info('Price check alarm triggered');
      await PriceChecker.checkAllProducts();
    } else {
      logger.debug('Price check skipped - popup is open');
    }
  }
});

/**
 * Message handler
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  logger.debug('Message received', { action: message.action });

  switch (message.action) {
    case 'popupOpened':
      isPopupOpen = true;
      logger.debug('Popup opened - pausing automatic checks');
      sendResponse({ success: true });
      return true;

    case 'popupClosed':
      isPopupOpen = false;
      logger.debug('Popup closed - resuming automatic checks');
      sendResponse({ success: true });
      return true;

    case 'ping':
      // Simple ping to keep service worker alive
      sendResponse({ success: true, pong: true });
      return true;
    case 'trackProduct':
      handleTrackProduct(message.url, message.productData)
        .then(result => sendResponse(result))
        .catch(error => {
          logger.error('Failed to track product', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response

    case 'openProduct':
      handleOpenProduct(message.productId)
        .then(() => sendResponse({ success: true }))
        .catch(error => {
          logger.error('Failed to open product', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'removeProduct':
      handleRemoveProduct(message.productId)
        .then(() => sendResponse({ success: true }))
        .catch(error => {
          logger.error('Failed to remove product', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'checkPricesNow':
      PriceChecker.checkAllProducts()
        .then(() => sendResponse({ success: true }))
        .catch((error: unknown) => {
          logger.error('Failed to check prices', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        });
      return true;

    case 'clearAllRateLimits':
      RateLimiter.clearAllBuckets()
        .then(() => sendResponse({ success: true }))
        .catch((error: unknown) => {
          logger.error('Failed to clear rate limits', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        });
      return true;

    case 'trimPriceHistories':
      StorageManager.trimAllPriceHistories()
        .then(() => sendResponse({ success: true }))
        .catch((error: unknown) => {
          logger.error('Failed to trim price histories', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        });
      return true;

    default:
      logger.warn('Unknown message action', { action: message.action });
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

/**
 * Handle track product request
 */
async function handleTrackProduct(
  url: string,
  extractedData?: ExtractedProductData,
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Tracking product', { url });

    // Normalize URL
    const normalizedUrl = normalizeUrl(url);

    // Get adapter
    const adapter = getAdapterForUrl(normalizedUrl);
    if (!adapter) {
      return { success: false, error: 'Unsupported website' };
    }

    let data: ExtractedProductData | null = extractedData ?? null;

    if (!data) {
      const response = await fetch(normalizedUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const html = await response.text();
      data = await adapter.extractData(html);
    }

    if (!data.available) {
      return { success: false, error: data.error || 'Product not available' };
    }

    // Send to backend first (get shared history)
    const backendResponse = await addPriceToBackend({
      url: normalizedUrl,
      price: data.price,
      currency: data.currency,
      title: data.title,
      platform: adapter.name,
      imageUrl: data.imageUrl,
    });

    if (!backendResponse.success) {
      logger.warn('Backend sync failed, continuing with local-only mode', {
        error: backendResponse.error,
      });
    }

    // Create product metadata (lightweight, no imageUrl or priceHistory)
    const product: TrackedProduct = {
      id: generateId(),
      title: data.title,
      url: normalizedUrl,
      currentPrice: data.price,
      initialPrice: data.price,
      currency: data.currency,
      adapter: adapter.name,
      addedAt: getCurrentTimestamp(),
      lastCheckedAt: getCurrentTimestamp(),
      isActive: true,
    };

    // Save metadata to local storage
    await StorageManager.addProduct(product);

    logger.info('Product tracked successfully', {
      productId: product.id,
      title: product.title,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to track product', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle open product request
 */
async function handleOpenProduct(productId: string): Promise<void> {
  const products = await StorageManager.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product) {
    throw new Error('Product not found');
  }

  // Get adapter and generate affiliate URL
  const adapter = getAdapterForUrl(product.url);
  const url = adapter ? adapter.generateAffiliateUrl(product.url) : product.url;

  // Open in new tab
  await chrome.tabs.create({ url });

  logger.info('Product opened', { productId, url });
}

/**
 * Handle remove product request
 */
async function handleRemoveProduct(productId: string): Promise<void> {
  await StorageManager.removeProduct(productId);
  logger.info('Product removed', { productId });
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  logger.info('Service worker started');
});
