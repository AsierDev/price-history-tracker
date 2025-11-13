# Developer Guide – Price History Tracker

This document explains the internal architecture, local development workflow, testing strategy, and troubleshooting tips for contributors.

---

## 1. Architecture Overview

### 1.1 Tiered Adapter System

Adapters implement `PriceAdapter` and are resolved in three tiers:

1. **Specific adapters** (Amazon, eBay, AliExpress, MediaMarkt, PC Componentes) – full auto-extraction.
2. **Whitelist adapters** (`EnhancedGenericAdapter`) – auto extraction for 600+ curated domains.
3. **Manual fallback** (`GenericAdapter`) – requires a CSS selector provided by the price picker.

`src/adapters/registry.ts` exposes helpers (`getAdapterForUrl`, `getTierInfo`, `getBadgeInfo`, `isSupportedSite`) for both the service worker and popup/content UIs.

### 1.2 Data Flow

```
Content Script ──► injects CTA + price picker
      │
      ▼
Service Worker ──► receives product metadata, normalizes URL, resolves adapter
      │
      ▼
Storage Manager ──► persists one key per product + rate-limit buckets in chrome.storage.local
      │
      ├─► PriceChecker (scheduled/ manual runs)
      └─► Firebase backend (optional shared history)
      │
      ▼
Popup UI ──► reads cached data, renders cards/graphs, dispatches actions
```

### 1.3 Rate Limiting

Serial execution is intentionally throttled:

| Failure count | Backoff |
| --- | --- |
| 1st | 1 minute |
| 2nd | 5 minutes |
| 3rd | 30 minutes |
| 4th+ | 120 minutes |

Buckets are keyed by normalized domain and stored in `chrome.storage.local` via `RateLimiter`.

### 1.4 HTML Parsing

Every adapter (including helper utilities) must parse HTML with `createDocument(html)` from `src/utils/htmlParser.ts`. The helper wraps **linkedom**, which works in MV3 service workers; `DOMParser` is not available and will break manual tracking.

---

## 2. Tech Stack

| Layer | Technology |
| --- | --- |
| Language | TypeScript (strict) |
| Bundler | esbuild (ES module output) |
| Runtime | Chrome Extension MV3 (service worker background) |
| DOM Parsing | linkedom |
| UI | Vanilla TS + Chart.js in popup |
| Testing | Vitest + jsdom, chrome API mocks |
| Backend (optional) | Firebase Firestore + anonymous auth |

Chart.js rendering is handled in `popup/popup.ts` (`renderPriceChart`, `updateHistoryStats`). When editing chart code make sure to destroy previous instances (`chart.destroy()`) before creating a new one.

---

## 3. Local Development

```bash
npm install          # install dependencies
npm run watch        # watch mode (esbuild)
npm run build        # production build
npm run lint         # ESLint for src + tests
```

### 3.1 Folder Structure

```
src/
├── adapters/              # adapter interfaces + registry + implementations
├── backend/               # Firebase helpers
├── config/                # supported sites + ENV
├── core/                  # StorageManager, PriceChecker, RateLimiter, NotificationManager
├── popup/                 # popup logic, HTML, styles
├── utils/                 # html parser, metadata extractor, price parser, logger
├── content-script.ts      # button injection + price picker
├── service-worker.ts      # background router + tracking flows
└── manifest.json          # MV3 manifest
```

`tests/` mirrors the structure (adapters, core, utils, integration, performance).

---

## 4. Adding a New Platform

1. Create `src/adapters/implementations/<platform>.adapter.ts`.
2. Implement `PriceAdapter` (use `createDocument`, return structured errors, support multiple selectors).
3. Register it inside `src/adapters/registry.ts` (specific adapter list).
4. Extend manifest permissions only if the adapter needs additional host permissions.
5. Add tests under `tests/adapters/`.

See [`docs/README-ADAPTERS.md`](README-ADAPTERS.md) for a full template and testing checklist.

---

## 5. Testing

- `npm test` runs Vitest (unit + integration) with mocked chrome APIs.
- `npm run test:coverage` generates `coverage/` reports (global threshold 60%).
- `PRICECHECKER_PERF=true npx vitest run tests/performance/priceChecker.performance.test.ts` benchmarks the serial checker (current baseline ≈ 1 s/product).

Manual QA steps (browsers, adapters, popup interactions, notifications, rate limiting) live in [`docs/TESTING_GUIDE.md`](TESTING_GUIDE.md). Keep that guide updated whenever UI flows change.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| “Track Price” button missing | URL does not match adapter/whitelist | Confirm adapter patterns and supportedSites entry |
| Manual tracking fails silently | `customSelector` not provided or `createDocument` not used | Ensure price picker sent selector; verify adapter uses linkedom |
| Popup shows “generic” instead of store name | `storeName` missing in metadata | Check `extractMetadata` result in content script |
| No notifications | Drop < threshold or Chrome notifications disabled | Lower threshold via settings or enable Chrome notifications |
| Firebase errors | `.env` misconfigured or anonymous auth disabled | Follow [`docs/FIREBASE_SETUP.md`](FIREBASE_SETUP.md) and rebuild |

Check the service worker logs via `chrome://extensions` → “Service worker” → Console for detailed output. Use `chrome.storage.local.get(null, console.log)` to inspect persisted keys.

---

## 7. Releasing

1. Update version in `package.json` (semantic).
2. `npm run build`
3. Run lint + tests (`npm run lint && npm test`).
4. Audit bundle for injected secrets (see README release checklist).
5. Zip `dist/` and upload to the Chrome Web Store.
6. Tag the release (`git tag vX.Y.Z && git push --tags`).

Need help? Open an issue in the repository or ask in the team channel.
