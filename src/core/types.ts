/**
 * Core type definitions for Price History Tracker
 */

export interface PriceHistoryEntry {
  price: number;
  timestamp: number;
  checkedAt: number;
}

/**
 * Local storage metadata (lightweight, no history or images)
 * Stored in chrome.storage.local with individual keys per product
 */
export interface TrackedProduct {
  id: string;
  title: string;
  url: string;
  currentPrice: number;
  initialPrice: number;
  currency: string;
  adapter: string;
  addedAt: number;
  lastCheckedAt: number;
  isActive: boolean;
  customSelector?: string; // For generic adapter: CSS selector to find price element
  storeName?: string; // For generic adapter: store name (e.g., "MediaMarkt", "PC Componentes")
  // imageUrl and priceHistory are NOT stored locally (moved to backend)
}

/**
 * Backend price data point (Firebase Firestore)
 */
export interface PriceDataPoint {
  price: number;
  currency: string;
  timestamp: number;
  source: 'user' | 'check';
}

/**
 * Complete product document in Firebase Firestore
 */
export interface ProductDocument {
  url: string;
  title: string;
  platform: string;
  imageUrl?: string;
  priceHistory: PriceDataPoint[];
  lastUpdated: number;
  contributorCount: number;
}

export interface AffiliateIds {
  amazon?: string;
  ebay?: string;
  aliexpress?: string;
  tradetracker?: string;
  belboon?: string;
  awin?: string;
}

export interface ExtensionConfig {
  checkIntervalHours: number;
  maxProductsTracked: number;
  priceDropThreshold: number;
  serialMode: boolean;
  notificationsEnabled: boolean;
  affiliateIds: AffiliateIds;
}

export interface RateLimitBucket {
  domain: string;
  failureCount: number;
  nextRetryAt: number;
  backoffMinutes: number;
}

/**
 * Legacy storage structure (deprecated, migrating to individual keys)
 */
export interface StorageData {
  products: TrackedProduct[];
  rateLimitBuckets: Record<string, RateLimitBucket>;
  config: ExtensionConfig;
  lastCheckTime: number;
  anonymousUserId?: string;
}

/**
 * New storage structure (individual keys per product)
 */
export interface LocalStorageStructure {
  config: ExtensionConfig;
  anonymousUserId?: string;
  lastCheckTime: number;
  // Products stored as: product_${id}: TrackedProduct
  // Rate limits stored as: rateLimit_${domain}: RateLimitBucket
}

export interface ExtractedProductData {
  title: string;
  price: number;
  imageUrl?: string;
  currency: string;
  available: boolean;
  error?: string;
}

export interface NotificationData {
  productId: string;
  title: string;
  oldPrice: number;
  newPrice: number;
  percentDrop: number;
  url: string;
}
