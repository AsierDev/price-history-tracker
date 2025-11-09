import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageManager } from '@core/storage';
import { createMockProduct } from '@helpers/mocks';

const mockChromeStorage = {
  get: vi.fn<(_keys: string[] | string | null) => Promise<Record<string, unknown>>>(),
  set: vi.fn<(_data: Record<string, unknown>) => Promise<void>>(),
  remove: vi.fn<(_keys: string | string[]) => Promise<void>>(),
  clear: vi.fn<() => Promise<void>>(),
};

beforeEach(() => {
  vi.clearAllMocks();
  global.chrome = {
    storage: {
      local: mockChromeStorage,
    },
  } as unknown as typeof global.chrome;
});

describe('StorageManager', () => {
  describe('getProducts', () => {
    it('should return empty array when no products', async () => {
      mockChromeStorage.get.mockResolvedValue({});
      const products = await StorageManager.getProducts();
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBe(0);
    });

    it('should return products from storage', async () => {
      const product = createMockProduct();
      mockChromeStorage.get.mockResolvedValue({
        product_test_product_id: product,
      });
      const products = await StorageManager.getProducts();
      expect(products.length).toBeGreaterThan(0);
    });
  });

  describe('addProduct', () => {
    it('should add product to storage', async () => {
      const product = createMockProduct();
      mockChromeStorage.get.mockResolvedValueOnce({});
      mockChromeStorage.get.mockResolvedValueOnce({ config: { maxProductsTracked: 50 } });
      
      await StorageManager.addProduct(product);
      expect(mockChromeStorage.set).toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should return config', async () => {
      mockChromeStorage.get.mockResolvedValue({});
      const config = await StorageManager.getConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should have maxProductsTracked property', async () => {
      mockChromeStorage.get.mockResolvedValue({});
      const config = await StorageManager.getConfig();
      expect(config.maxProductsTracked).toBeDefined();
    });
  });

  describe('updateConfig', () => {
    it('should update config', async () => {
      mockChromeStorage.get.mockResolvedValue({});
      await StorageManager.updateConfig({ checkIntervalHours: 12 });
      expect(mockChromeStorage.set).toHaveBeenCalled();
    });
  });

  describe('clearAll', () => {
    it('should clear all storage', async () => {
      await StorageManager.clearAll();
      expect(mockChromeStorage.clear).toHaveBeenCalled();
    });
  });

  describe('getAnonymousUserId', () => {
    it('should get anonymous user ID', async () => {
      mockChromeStorage.get.mockResolvedValue({ anonymousUserId: 'test-id' });
      const id = await StorageManager.getAnonymousUserId();
      expect(id).toBe('test-id');
    });
  });

  describe('setAnonymousUserId', () => {
    it('should set anonymous user ID', async () => {
      await StorageManager.setAnonymousUserId('new-id');
      expect(mockChromeStorage.set).toHaveBeenCalled();
    });
  });

  describe('getLastCheckTime', () => {
    it('should get last check time', async () => {
      const timestamp = Date.now();
      mockChromeStorage.get.mockResolvedValue({ lastCheckTime: timestamp });
      const time = await StorageManager.getLastCheckTime();
      expect(time).toBe(timestamp);
    });

    it('should return 0 when no last check time', async () => {
      mockChromeStorage.get.mockResolvedValue({});
      const time = await StorageManager.getLastCheckTime();
      expect(time).toBe(0);
    });
  });

  describe('updateLastCheckTime', () => {
    it('should update last check time', async () => {
      const timestamp = Date.now();
      await StorageManager.updateLastCheckTime(timestamp);
      expect(mockChromeStorage.set).toHaveBeenCalled();
    });
  });
});
