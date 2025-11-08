/**
 * Application constants
 */

export const STORAGE_KEYS = {
  PRICE_TRACKER_DATA: 'priceTrackerData',
} as const;

export const LIMITS = {
  MAX_PRODUCTS: 50,
  MAX_HISTORY_ENTRIES: 50,
  PRICE_CHECK_INTERVAL_MINUTES: 360, // 6 hours
} as const;

export const PERCENTAGES = {
  PRICE_DROP_THRESHOLD: 5,
} as const;

export const RATE_LIMIT_BACKOFF_MINUTES = {
  FIRST_FAILURE: 1,
  SECOND_FAILURE: 5,
  THIRD_FAILURE: 30,
  SUBSEQUENT_FAILURES: 120, // 2 hours
} as const;
