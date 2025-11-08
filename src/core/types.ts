/**
 * Core type definitions for Price History Tracker
 */

export interface PriceHistoryEntry {
  price: number;
  timestamp: number;
  checkedAt: number;
}

export interface TrackedProduct {
  id: string;
  title: string;
  url: string;
  imageUrl?: string;
  currentPrice: number;
  initialPrice: number;
  currency: string;
  adapter: string;
  addedAt: number;
  lastCheckedAt: number;
  priceHistory: PriceHistoryEntry[];
  isActive: boolean;
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
  affiliateIds: AffiliateIds;
}

export interface RateLimitBucket {
  domain: string;
  failureCount: number;
  nextRetryAt: number;
  backoffMinutes: number;
}

export interface StorageData {
  products: TrackedProduct[];
  rateLimitBuckets: Record<string, RateLimitBucket>;
  config: ExtensionConfig;
  lastCheckTime: number;
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
