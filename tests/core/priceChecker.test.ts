import { describe, it, expect } from 'vitest';
import { PriceChecker } from '@core/priceChecker';

describe('PriceChecker', () => {
  it('should be defined', () => {
    expect(PriceChecker).toBeDefined();
  });

  it('should have checkAllProducts method', () => {
    expect(typeof PriceChecker.checkAllProducts).toBe('function');
  });

  it('should have checkProduct method', () => {
    expect(typeof PriceChecker.checkProduct).toBe('function');
  });
});
