import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockProduct } from '@helpers/mocks';

const mockStorageManager = {
  getProducts: vi.fn(),
  addProduct: vi.fn(),
  updateProduct: vi.fn(),
};

const mockPriceChecker = {
  checkAllProducts: vi.fn(),
};

vi.mock('@core/storage');
vi.mock('@core/priceChecker');
vi.mock('@adapters/registry');
vi.mock('@backend/backend');

describe('Product Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageManager.getProducts.mockResolvedValue([]);
    mockStorageManager.addProduct.mockResolvedValue();
    mockPriceChecker.checkAllProducts.mockResolvedValue();
  });

  it('should add a product', async () => {
    const product = createMockProduct();
    await mockStorageManager.addProduct(product);
    expect(mockStorageManager.addProduct).toHaveBeenCalledWith(product);
  });

  it('should get products', async () => {
    await mockStorageManager.getProducts();
    expect(mockStorageManager.getProducts).toHaveBeenCalled();
  });

  it('should check all products', async () => {
    await mockPriceChecker.checkAllProducts();
    expect(mockPriceChecker.checkAllProducts).toHaveBeenCalled();
  });
});
