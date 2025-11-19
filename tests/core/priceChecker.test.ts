import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PriceChecker } from '@core/priceChecker';
import type { TrackedProduct, ExtensionConfig } from '@core/types';
import { createMockProduct, createMockExtractedData, MockChromeStorage } from '../helpers/mocks';

// Mock all dependencies
vi.mock('@core/storage');
vi.mock('@core/rateLimiter');
vi.mock('@core/notificationManager');
vi.mock('@adapters/registry');
vi.mock('@utils/dateUtils');
vi.mock('@backend/backend');

// Import mocked modules
import { StorageManager } from '@core/storage';
import { RateLimiter } from '@core/rateLimiter';
import { NotificationManager } from '@core/notificationManager';
import { getAdapterForUrl } from '@adapters/registry';
import { getCurrentTimestamp } from '@utils/dateUtils';
import { updatePriceInBackend } from '@backend/backend';

describe('PriceChecker', () => {
  let mockStorage: MockChromeStorage;
  let mockTimestamp: number;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup mock storage
    mockStorage = new MockChromeStorage();
    (global as unknown as { chrome: { storage: { local: MockChromeStorage } } }).chrome = {
      storage: {
        local: mockStorage,
      },
    };

    // Setup mock timestamp
    mockTimestamp = 1700000000000;
    vi.mocked(getCurrentTimestamp).mockReturnValue(mockTimestamp);

    // Setup mock fetch
    mockFetch = vi.fn();
    (global as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

    // Setup default config
    const mockConfig: ExtensionConfig = {
      checkIntervalHours: 6,
      maxProductsTracked: 50,
      priceDropThreshold: 5,
      serialMode: true,
      notificationsEnabled: true,
      affiliateIds: {},
    };
    vi.mocked(StorageManager.getConfig).mockResolvedValue(mockConfig);
    vi.mocked(StorageManager.updateLastCheckTime).mockResolvedValue();
    vi.mocked(StorageManager.updateProduct).mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkAllProducts', () => {
    it('should check all active products', async () => {
      const products: TrackedProduct[] = [
        createMockProduct({ id: 'p1', isActive: true }),
        createMockProduct({ id: 'p2', isActive: true }),
      ];

      vi.mocked(StorageManager.getProducts).mockResolvedValue(products);
      vi.mocked(RateLimiter.isRateLimited).mockResolvedValue(false);

      // Mock successful price checks
      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockResolvedValue(createMockExtractedData()),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      });

      vi.mocked(RateLimiter.recordSuccess).mockResolvedValue();
      vi.mocked(updatePriceInBackend).mockResolvedValue();

      await PriceChecker.checkAllProducts();

      expect(StorageManager.getProducts).toHaveBeenCalled();
      expect(mockAdapter.extractData).toHaveBeenCalledTimes(2);
      expect(StorageManager.updateLastCheckTime).toHaveBeenCalledWith(mockTimestamp);
    });

    it('should skip inactive products', async () => {
      const products: TrackedProduct[] = [
        createMockProduct({ id: 'p1', isActive: true }),
        createMockProduct({ id: 'p2', isActive: false }),
        createMockProduct({ id: 'p3', isActive: true }),
      ];

      vi.mocked(StorageManager.getProducts).mockResolvedValue(products);
      vi.mocked(RateLimiter.isRateLimited).mockResolvedValue(false);

      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockResolvedValue(createMockExtractedData()),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      });

      vi.mocked(RateLimiter.recordSuccess).mockResolvedValue();
      vi.mocked(updatePriceInBackend).mockResolvedValue();

      await PriceChecker.checkAllProducts();

      // Should only check 2 active products
      expect(mockAdapter.extractData).toHaveBeenCalledTimes(2);
    });

    it('should skip rate-limited products', async () => {
      const products: TrackedProduct[] = [
        createMockProduct({ id: 'p1', url: 'https://amazon.es/p1' }),
        createMockProduct({ id: 'p2', url: 'https://amazon.es/p2' }),
      ];

      vi.mocked(StorageManager.getProducts).mockResolvedValue(products);
      
      // First product is rate-limited
      vi.mocked(RateLimiter.isRateLimited)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      
      vi.mocked(RateLimiter.getMinutesUntilRetry).mockResolvedValue(30);

      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockResolvedValue(createMockExtractedData()),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      });

      vi.mocked(RateLimiter.recordSuccess).mockResolvedValue();
      vi.mocked(updatePriceInBackend).mockResolvedValue();

      await PriceChecker.checkAllProducts();

      // Should only check 1 product (p2)
      expect(mockAdapter.extractData).toHaveBeenCalledTimes(1);
      expect(RateLimiter.getMinutesUntilRetry).toHaveBeenCalledWith('https://amazon.es/p1');
    });

    it('should handle errors gracefully and continue checking', async () => {
      const products: TrackedProduct[] = [
        createMockProduct({ id: 'p1' }),
        createMockProduct({ id: 'p2' }),
        createMockProduct({ id: 'p3' }),
      ];

      vi.mocked(StorageManager.getProducts).mockResolvedValue(products);
      vi.mocked(RateLimiter.isRateLimited).mockResolvedValue(false);

      const mockAdapter = {
        enabled: true,
        extractData: vi.fn()
          .mockRejectedValueOnce(new Error('Network error')) // p1 fails
          .mockResolvedValueOnce(createMockExtractedData()) // p2 succeeds
          .mockResolvedValueOnce(createMockExtractedData()), // p3 succeeds
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      });

      vi.mocked(RateLimiter.recordSuccess).mockResolvedValue();
      vi.mocked(RateLimiter.recordFailure).mockResolvedValue();
      vi.mocked(updatePriceInBackend).mockResolvedValue();

      await PriceChecker.checkAllProducts();

      // Should attempt all 3 products despite p1 failing
      expect(mockAdapter.extractData).toHaveBeenCalledTimes(3);
      expect(StorageManager.updateLastCheckTime).toHaveBeenCalled();
    });

    it('should handle empty product list', async () => {
      vi.mocked(StorageManager.getProducts).mockResolvedValue([]);

      await PriceChecker.checkAllProducts();

      expect(StorageManager.updateLastCheckTime).toHaveBeenCalledWith(mockTimestamp);
    });
  });

  describe('checkProduct', () => {
    it('should fetch product page and extract data', async () => {
      const product = createMockProduct({ currentPrice: 29.99 });
      const extractedData = createMockExtractedData({ price: 29.99 });

      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockResolvedValue(extractedData),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html>Product Page</html>',
      });

      vi.mocked(RateLimiter.recordSuccess).mockResolvedValue();
      vi.mocked(updatePriceInBackend).mockResolvedValue();

      const result = await PriceChecker.checkProduct(product);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        product.url,
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla'),
          }),
        })
      );
      expect(mockAdapter.extractData).toHaveBeenCalledWith('<html>Product Page</html>', undefined);
      expect(RateLimiter.recordSuccess).toHaveBeenCalledWith(product.url);
    });

    it('should handle missing adapter', async () => {
      const product = createMockProduct();
      vi.mocked(getAdapterForUrl).mockReturnValue(null);

      const result = await PriceChecker.checkProduct(product);

      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle disabled adapter', async () => {
      const product = createMockProduct();
      const mockAdapter = { enabled: false };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      const result = await PriceChecker.checkProduct(product);

      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle HTTP errors', async () => {
      const product = createMockProduct();
      const mockAdapter = { enabled: true };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      vi.mocked(RateLimiter.recordFailure).mockResolvedValue();

      const result = await PriceChecker.checkProduct(product);

      expect(result.success).toBe(false);
      expect(RateLimiter.recordFailure).toHaveBeenCalledWith(
        product.url,
        expect.stringContaining('404')
      );
    });

    it('should handle unavailable products', async () => {
      const product = createMockProduct();
      const extractedData = createMockExtractedData({
        available: false,
        error: 'Out of stock',
      });

      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockResolvedValue(extractedData),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      });

      vi.mocked(RateLimiter.recordFailure).mockResolvedValue();

      const result = await PriceChecker.checkProduct(product);

      expect(result.success).toBe(false);
      expect(RateLimiter.recordFailure).toHaveBeenCalledWith(product.url, 'Out of stock');
    });

    it('should detect price changes', async () => {
      const product = createMockProduct({ currentPrice: 29.99 });
      const extractedData = createMockExtractedData({ price: 24.99 }); // Price dropped

      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockResolvedValue(extractedData),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      });

      vi.mocked(RateLimiter.recordSuccess).mockResolvedValue();
      vi.mocked(updatePriceInBackend).mockResolvedValue();
      vi.mocked(NotificationManager.notifyPriceDrop).mockResolvedValue();

      const result = await PriceChecker.checkProduct(product);

      expect(result.success).toBe(true);
      expect(StorageManager.updateProduct).toHaveBeenCalledWith(
        product.id,
        expect.objectContaining({
          currentPrice: 24.99,
          lastCheckedAt: mockTimestamp,
        })
      );
    });

    it('should not update price if change is negligible', async () => {
      const product = createMockProduct({ currentPrice: 29.99 });
      const extractedData = createMockExtractedData({ price: 29.99 }); // Same price

      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockResolvedValue(extractedData),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      });

      vi.mocked(RateLimiter.recordSuccess).mockResolvedValue();
      vi.mocked(updatePriceInBackend).mockResolvedValue();

      const result = await PriceChecker.checkProduct(product);

      expect(result.success).toBe(true);
      expect(StorageManager.updateProduct).toHaveBeenCalledWith(
        product.id,
        expect.objectContaining({
          lastCheckedAt: mockTimestamp,
        })
      );
      // Should not include currentPrice in update
      expect(StorageManager.updateProduct).toHaveBeenCalledWith(
        product.id,
        expect.not.objectContaining({
          currentPrice: expect.anything(),
        })
      );
    });

    it('should update backend asynchronously', async () => {
      const product = createMockProduct({ currentPrice: 29.99 });
      const extractedData = createMockExtractedData({ price: 24.99 });

      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockResolvedValue(extractedData),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      });

      vi.mocked(RateLimiter.recordSuccess).mockResolvedValue();
      vi.mocked(updatePriceInBackend).mockResolvedValue();

      await PriceChecker.checkProduct(product);

      expect(updatePriceInBackend).toHaveBeenCalledWith({
        url: product.url,
        price: 24.99,
        currency: product.currency,
        title: product.title,
        platform: product.adapter,
      });
    });

    it('should handle generic adapter with custom selector', async () => {
      const product = createMockProduct({
        adapter: 'generic',
        customSelector: '.price-element',
      });
      const extractedData = createMockExtractedData();

      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockResolvedValue(extractedData),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      });

      vi.mocked(RateLimiter.recordSuccess).mockResolvedValue();
      vi.mocked(updatePriceInBackend).mockResolvedValue();

      await PriceChecker.checkProduct(product);

      expect(mockAdapter.extractData).toHaveBeenCalledWith('<html></html>', '.price-element');
    });

    it('should handle generic adapter with broken selector', async () => {
      const product = createMockProduct({
        adapter: 'generic',
        customSelector: '.broken-selector',
      });
      const extractedData = createMockExtractedData({
        available: false,
        error: 'Price element not found',
      });

      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockResolvedValue(extractedData),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      });

      vi.mocked(RateLimiter.recordFailure).mockResolvedValue();

      const result = await PriceChecker.checkProduct(product);

      expect(result.success).toBe(false);
      expect(RateLimiter.recordFailure).toHaveBeenCalledWith(
        product.url,
        'Price element not found'
      );
    });
  });

  describe('handlePriceChange (via checkProduct)', () => {
    it('should trigger notification when price drop >= threshold', async () => {
      const product = createMockProduct({ currentPrice: 100, title: 'Test Product' });
      const extractedData = createMockExtractedData({ price: 90 }); // 10% drop

      const mockConfig: ExtensionConfig = {
        checkIntervalHours: 6,
        maxProductsTracked: 50,
        priceDropThreshold: 5, // 5% threshold
        serialMode: true,
        notificationsEnabled: true,
        affiliateIds: {},
      };
      vi.mocked(StorageManager.getConfig).mockResolvedValue(mockConfig);

      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockResolvedValue(extractedData),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      });

      vi.mocked(RateLimiter.recordSuccess).mockResolvedValue();
      vi.mocked(updatePriceInBackend).mockResolvedValue();
      vi.mocked(NotificationManager.notifyPriceDrop).mockResolvedValue();

      await PriceChecker.checkProduct(product);

      expect(NotificationManager.notifyPriceDrop).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: product.id,
          title: 'Test Product',
          oldPrice: 100,
          newPrice: 90,
          percentDrop: 10,
          url: product.url,
        })
      );
    });

    it('should not notify for small price drops below threshold', async () => {
      const product = createMockProduct({ currentPrice: 100 });
      const extractedData = createMockExtractedData({ price: 97 }); // 3% drop

      const mockConfig: ExtensionConfig = {
        checkIntervalHours: 6,
        maxProductsTracked: 50,
        priceDropThreshold: 5, // 5% threshold
        serialMode: true,
        notificationsEnabled: true,
        affiliateIds: {},
      };
      vi.mocked(StorageManager.getConfig).mockResolvedValue(mockConfig);

      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockResolvedValue(extractedData),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      });

      vi.mocked(RateLimiter.recordSuccess).mockResolvedValue();
      vi.mocked(updatePriceInBackend).mockResolvedValue();

      await PriceChecker.checkProduct(product);

      expect(NotificationManager.notifyPriceDrop).not.toHaveBeenCalled();
    });

    it('should not notify for price increases', async () => {
      const product = createMockProduct({ currentPrice: 100 });
      const extractedData = createMockExtractedData({ price: 110 }); // Price increased

      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockResolvedValue(extractedData),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      });

      vi.mocked(RateLimiter.recordSuccess).mockResolvedValue();
      vi.mocked(updatePriceInBackend).mockResolvedValue();

      await PriceChecker.checkProduct(product);

      expect(NotificationManager.notifyPriceDrop).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle network failures', async () => {
      const product = createMockProduct();
      const mockAdapter = { enabled: true };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockRejectedValue(new Error('Network error'));
      vi.mocked(RateLimiter.recordFailure).mockResolvedValue();

      const result = await PriceChecker.checkProduct(product);

      expect(result.success).toBe(false);
      expect(RateLimiter.recordFailure).toHaveBeenCalledWith(
        product.url,
        'Network error'
      );
    });

    it('should handle invalid HTML responses', async () => {
      const product = createMockProduct();
      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockResolvedValue({
          available: false,
          error: 'Failed to parse HTML',
          title: '',
          price: 0,
          currency: 'EUR',
        }),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => 'invalid html',
      });

      vi.mocked(RateLimiter.recordFailure).mockResolvedValue();

      const result = await PriceChecker.checkProduct(product);

      expect(result.success).toBe(false);
    });

    it('should handle adapter extraction failures', async () => {
      const product = createMockProduct();
      const mockAdapter = {
        enabled: true,
        extractData: vi.fn().mockRejectedValue(new Error('Extraction failed')),
      };
      vi.mocked(getAdapterForUrl).mockReturnValue(mockAdapter as unknown as ReturnType<typeof getAdapterForUrl>);

      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      });

      vi.mocked(RateLimiter.recordFailure).mockResolvedValue();

      const result = await PriceChecker.checkProduct(product);

      expect(result.success).toBe(false);
      expect(RateLimiter.recordFailure).toHaveBeenCalled();
    });
  });
});
