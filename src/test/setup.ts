// Test setup for Chrome extension tests
import { beforeAll, vi } from 'vitest';

const createEventMock = () => ({
  addListener: vi.fn(),
  removeListener: vi.fn(),
  hasListener: vi.fn(),
});

// Mock Chrome API (subset needed for tests)
const mockChrome = {
  storage: {
    onChanged: createEventMock(),
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    },
  },
  alarms: {
    create: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(true),
    onAlarm: createEventMock(),
  },
  notifications: {
    create: vi.fn().mockResolvedValue('notification-id'),
    clear: vi.fn().mockResolvedValue(true),
    onClicked: createEventMock(),
  },
  runtime: {
    onInstalled: createEventMock(),
    onMessage: createEventMock(),
    onStartup: createEventMock(),
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
  },
  tabs: {
    create: vi.fn().mockResolvedValue(undefined),
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
