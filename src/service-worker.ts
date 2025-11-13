/**
 * Service Worker - Background orchestration for price checking
 */

import type { TrackedProduct, ExtractedProductData } from './core/types';
import { StorageManager } from './core/storage';
import { PriceChecker } from './core/priceChecker';
import { RateLimiter } from './core/rateLimiter';
import { NotificationManager } from './core/notificationManager';
import { getAdapterForUrl, getTierInfo, getBadgeInfo } from './adapters/registry';
import { getCurrentTimestamp } from './utils/dateUtils';
import { normalizeUrl } from './utils/urlUtils';
import { logger } from './utils/logger';
import { addPriceToBackend } from './backend/backend';
import { parseGenericPrice } from './utils/priceParser';
import type { ExtractedMetadata } from './utils/metadataExtractor';
import { isSupportedSite, getSiteInfo } from './config/supportedSites';

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
    await StorageManager.migrateLegacyFormat();
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
      handleTrackProduct(message.url, message.productData, message.metadata)
        .then(result => sendResponse(result))
        .catch(error => {
          logger.error('Failed to track product', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response

    case 'trackProductManual':
      handleTrackProductManual(message.url, message.priceElement, message.metadata)
        .then(result => sendResponse(result))
        .catch(error => {
          logger.error('Failed to track product manually', error);
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

    case 'updateAlarm':
      handleUpdateAlarm(message.intervalHours)
        .then(() => sendResponse({ success: true }))
        .catch((error: unknown) => {
          logger.error('Failed to update alarm', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        });
      return true;
    case 'getTierInfo':
      if (!message.url) {
        sendResponse({ success: false, error: 'Missing URL' });
        return false;
      }
      sendResponse(getTierInfo(message.url));
      return false;
    case 'getBadgeInfo':
      if (!message.url) {
        sendResponse({ success: false, error: 'Missing URL' });
        return false;
      }
      sendResponse(getBadgeInfo(message.url));
      return false;
    case 'getAdapterForUrl':
      if (!message.url) {
        sendResponse({ success: false, error: 'Missing URL' });
        return false;
      }
      sendResponse({ name: getAdapterForUrl(message.url).name });
      return false;
    case 'isSupportedSite':
      if (!message.domain) {
        sendResponse({ supported: false });
        return false;
      }
      sendResponse({
        supported: isSupportedSite(message.domain),
        siteInfo: getSiteInfo(message.domain),
      });
      return false;

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
  metadata?: ExtractedMetadata,
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

    const resolvedMetadata = resolveMetadata(metadata, data, normalizedUrl, adapter.name);

    // Send to backend first (get shared history)
    const backendResponse = await addPriceToBackend({
      url: normalizedUrl,
      price: data.price,
      currency: data.currency,
      title: resolvedMetadata.title,
      platform: adapter.name,
      imageUrl: resolvedMetadata.imageUrl ?? data.imageUrl,
    });

    if (!backendResponse.success) {
      logger.warn('Backend sync failed, continuing with local-only mode', {
        error: backendResponse.error,
      });
    }

    // Create product metadata (lightweight, no imageUrl or priceHistory)
    const product: TrackedProduct = {
      id: generateId(),
      title: resolvedMetadata.title,
      url: normalizedUrl,
      currentPrice: data.price,
      initialPrice: data.price,
      currency: data.currency,
      adapter: adapter.name,
      storeName: resolvedMetadata.storeName,
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
 * Handle manual track product request (with custom selector)
 */
async function handleTrackProductManual(
  url: string,
  priceElement: { selector: string; text: string },
  metadata?: ExtractedMetadata
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info('Tracking product manually', { url, selector: priceElement.selector });

    // Normalize URL
    const normalizedUrl = normalizeUrl(url);

    // Parse price from selected text
    const parsedPrice = parseGenericPrice(priceElement.text);
    if (!parsedPrice) {
      return {
        success: false,
        error: 'Could not parse price from selected element. Please try selecting a different element.',
      };
    }

    logger.debug('Price parsed from manual selection', {
      price: parsedPrice.price,
      currency: parsedPrice.currency,
      rawText: parsedPrice.rawText,
    });

    const resolvedMetadata = resolveMetadata(metadata, undefined, normalizedUrl, 'generic');

    // Send to backend (shared history)
    const backendResponse = await addPriceToBackend({
      url: normalizedUrl,
      price: parsedPrice.price,
      currency: parsedPrice.currency,
      title: resolvedMetadata.title,
      platform: 'generic',
      imageUrl: resolvedMetadata.imageUrl,
    });

    if (!backendResponse.success) {
      logger.warn('Backend sync failed, continuing with local-only mode', {
        error: backendResponse.error,
      });
    }

    // Create product with custom selector and store name
    const product: TrackedProduct = {
      id: generateId(),
      title: resolvedMetadata.title,
      url: normalizedUrl,
      currentPrice: parsedPrice.price,
      initialPrice: parsedPrice.price,
      currency: parsedPrice.currency,
      adapter: 'generic',
      customSelector: priceElement.selector, // Store custom selector for future checks
      storeName: resolvedMetadata.storeName, // Store the store name for display in popup
      addedAt: getCurrentTimestamp(),
      lastCheckedAt: getCurrentTimestamp(),
      isActive: true,
    };

    // Save to local storage
    await StorageManager.addProduct(product);

    logger.info('Product tracked successfully (manual)', {
      productId: product.id,
      title: product.title,
      selector: priceElement.selector,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to track product manually', error);
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
  const product = await StorageManager.getProductById(productId);

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
 * Handle update alarm interval
 */
async function handleUpdateAlarm(intervalHours: number): Promise<void> {
  try {
    // Clear existing alarm
    await chrome.alarms.clear(ALARM_NAME);
    
    // Create new alarm with updated interval
    await chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 1, // First check after 1 minute
      periodInMinutes: intervalHours * 60,
    });
    
    logger.info('Alarm updated', { intervalHours });
  } catch (error) {
    logger.error('Failed to update alarm', error);
    throw error;
  }
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Resolve metadata coming from content script or fall back to extracted data
 */
function resolveMetadata(
  provided: ExtractedMetadata | undefined,
  extracted: ExtractedProductData | null | undefined,
  url: string,
  adapterName: string,
): ExtractedMetadata {
  let fallbackStore = adapterName || 'Tienda desconocida';
  let fallbackTitle = extracted?.title?.trim() || provided?.title?.trim() || 'Producto de la web';

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    fallbackStore = fallbackStore === adapterName ? hostname : fallbackStore;
    fallbackTitle = fallbackTitle || `Producto de ${hostname}`;
  } catch {
    // Ignore URL parsing errors
  }

  const resolved: ExtractedMetadata = {
    // Prefer adapter data when available (adapters usually have cleaner info)
    title: extracted?.title?.trim() || provided?.title?.trim() || fallbackTitle,
    imageUrl: extracted?.imageUrl || provided?.imageUrl,
    storeName: provided?.storeName || fallbackStore,
  };

  if (!provided) {
    logger.warn('Metadata missing from content script, using fallbacks', {
      url,
      adapterName,
    });
  }

  return resolved;
}

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  logger.info('Service worker started');
});
