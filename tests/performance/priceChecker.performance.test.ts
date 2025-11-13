import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { TrackedProduct } from '@core/types';

const RUN_PERF_SUITE = process.env.PRICECHECKER_PERF === 'true';
const PRODUCT_COUNT = Number(process.env.PRICECHECKER_PERF_PRODUCTS ?? '50');
const describePerf = RUN_PERF_SUITE ? describe : describe.skip;

const fakeProducts: TrackedProduct[] = Array.from({ length: PRODUCT_COUNT }, (_, index) => ({
  id: `perf-product-${index}`,
  title: `Perf Product ${index}`,
  url: `https://perf.example.com/product-${index}`,
  currentPrice: 100 + index,
  initialPrice: 100 + index,
  currency: 'EUR',
  adapter: 'mock-adapter',
  addedAt: Date.now(),
  lastCheckedAt: Date.now(),
  isActive: true,
}));

const storageMocks = {
  getProducts: vi.fn(async () => fakeProducts),
  getConfig: vi.fn(async () => ({
    checkIntervalHours: 6,
    maxProductsTracked: 100,
    priceDropThreshold: 5,
    serialMode: true,
    notificationsEnabled: true,
    affiliateIds: {},
  })),
  updateProduct: vi.fn(async () => {}),
  updateLastCheckTime: vi.fn(async () => {}),
};

const rateLimiterMocks = {
  isRateLimited: vi.fn(async () => false),
  getMinutesUntilRetry: vi.fn(async () => 0),
  recordSuccess: vi.fn(async () => {}),
  recordFailure: vi.fn(async () => {}),
};

const notificationMocks = {
  notifyPriceDrop: vi.fn(async () => {}),
};

const adapterMock = {
  name: 'mock-adapter',
  enabled: true,
  urlPatterns: [],
  requiresManualSelection: false,
  extractData: vi.fn(async () => ({
    title: 'Benchmark Product',
    price: 90,
    currency: 'EUR',
    available: true,
  })),
  generateAffiliateUrl: (url: string) => url,
};

const backendMock = {
  updatePriceInBackend: vi.fn(async () => ({ success: true })),
};

vi.mock('@core/storage', () => ({
  StorageManager: storageMocks,
}));

vi.mock('@core/rateLimiter', () => ({
  RateLimiter: rateLimiterMocks,
}));

vi.mock('@core/notificationManager', () => ({
  NotificationManager: notificationMocks,
}));

vi.mock('@adapters/registry', () => ({
  getAdapterForUrl: vi.fn(() => adapterMock),
}));

vi.mock('@backend/backend', () => ({
  updatePriceInBackend: backendMock.updatePriceInBackend,
}));

let PriceChecker: typeof import('@core/priceChecker')['PriceChecker'];

describePerf('PriceChecker performance benchmark', () => {
  beforeAll(async () => {
    ({ PriceChecker } = await import('@core/priceChecker'));

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '<html><body><span class="price">€90</span></body></html>',
    })) as unknown as typeof fetch;
  });

  it(`processes ${PRODUCT_COUNT} products sequentially`, async () => {
    const start = performance.now();
    await PriceChecker.checkAllProducts();
    const durationMs = performance.now() - start;
    const perProduct = durationMs / PRODUCT_COUNT;

    console.info(
      `[perf] PriceChecker serial run: ${durationMs.toFixed(0)} ms total (${perProduct.toFixed(0)} ms/product)`
    );

    expect(storageMocks.updateLastCheckTime).toHaveBeenCalled();
    expect(durationMs).toBeGreaterThanOrEqual(PRODUCT_COUNT * 900);
  }, 90_000);
});
