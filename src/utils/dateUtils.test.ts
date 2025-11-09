import { describe, it, expect } from 'vitest';
import { getCurrentTimestamp, addMinutes, isExpired } from './dateUtils';

describe('dateUtils', () => {
  describe('getCurrentTimestamp', () => {
    it('should return current timestamp', () => {
      const timestamp = getCurrentTimestamp();
      expect(typeof timestamp).toBe('number');
      expect(timestamp).toBeGreaterThan(0);
    });

    it('should return timestamp close to Date.now()', () => {
      const timestamp = getCurrentTimestamp();
      const now = Date.now();
      expect(Math.abs(timestamp - now)).toBeLessThan(1000);
    });
  });

  describe('addMinutes', () => {
    it('should add minutes to timestamp', () => {
      const timestamp = 1000000000;
      const result = addMinutes(timestamp, 5);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(timestamp);
    });

    it('should handle zero minutes', () => {
      const timestamp = 1000000000;
      const result = addMinutes(timestamp, 0);
      expect(result).toBe(timestamp);
    });
  });

  describe('isExpired', () => {
    it('should return boolean', () => {
      const result = isExpired(Date.now());
      expect(typeof result).toBe('boolean');
    });

    it('should return true for past timestamp', () => {
      const pastTimestamp = Date.now() - 10000;
      expect(isExpired(pastTimestamp)).toBe(true);
    });

    it('should return false for future timestamp', () => {
      const futureTimestamp = Date.now() + 10000;
      expect(isExpired(futureTimestamp)).toBe(false);
    });
  });
});
