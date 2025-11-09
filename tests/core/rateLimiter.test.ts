import { describe, it, expect } from 'vitest';
import { RateLimiter } from '@core/rateLimiter';

describe('RateLimiter', () => {
  it('should be defined', () => {
    expect(RateLimiter).toBeDefined();
  });

  it('should have isRateLimited method', () => {
    expect(typeof RateLimiter.isRateLimited).toBe('function');
  });

  it('should have recordSuccess method', () => {
    expect(typeof RateLimiter.recordSuccess).toBe('function');
  });

  it('should have recordFailure method', () => {
    expect(typeof RateLimiter.recordFailure).toBe('function');
  });
});
