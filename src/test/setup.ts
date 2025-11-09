// Test setup for Chrome extension tests
import { beforeAll, vi } from 'vitest';

// Mock Chrome API
const mockChrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
  },
  notifications: {
    create: vi.fn(),
  },
  runtime: {
    onInstalled: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn(),
  },
  tabs: {
    create: vi.fn(),
  },
};

global.chrome = mockChrome as unknown as typeof global.chrome;

// Mock fetch for network requests
global.fetch = vi.fn();

// Mock console methods to reduce noise during tests
beforeAll(() => {
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
});
