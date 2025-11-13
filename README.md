# 💰 Price History Tracker

Chrome extension that tracks price history across Amazon, eBay, AliExpress, MediaMarkt, PC Componentes, and hundreds of additional stores using a tiered adapter system plus a universal manual price picker.

[![CI](https://github.com/your-username/price-history-tracker/workflows/CI/badge.svg)](https://github.com/AsierDev/price-history-tracker/actions/)  
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 Quick Start

> Requirements: Node.js ≥ 20, npm ≥ 9

```bash
npm install            # install dependencies
npm run build          # build MV3 bundles

# Load in Chrome:
# 1. Go to chrome://extensions
# 2. Enable Developer Mode
# 3. Click “Load unpacked” and select dist/
```

---

## ✨ Features

- **Tiered adapters**
  - Tier 1: Dedicated adapters (Amazon, eBay, AliExpress, PC Componentes, MediaMarkt)
  - Tier 2: Enhanced Generic Adapter with whitelist (600+ stores) and cascading extraction (JSON-LD → OG/Twitter → platform selectors → heuristics)
  - Tier 3: Manual Generic Adapter + price picker fallback for any site
- **Manual tracking built for MV3** – `createDocument` (linkedom) replaces `DOMParser`, so the service worker can parse selected HTML safely.
- **Reusable StubAdapter** – AWIN, Belboon, and TradeTracker share a single no-op adapter with clear error messaging.
- **Store-aware popup cards** – manual and whitelist entries show the actual store name (`storeName`) instead of the adapter key.
- **Automatic checks** – runs every 6 hours with exponential backoff per domain (1 min → 5 min → 30 min → 2 h) to avoid bans.
- **Notifications & charts** – configurable drop threshold (default 5%), Chart.js history, light/dark mode.
- **Firebase hooks (optional)** – anonymous auth + Firestore integration for shared history; the extension still works offline when Firebase vars are empty.
- **Performance benchmark** – `PRICECHECKER_PERF=true npx vitest run tests/performance/priceChecker.performance.test.ts` logs total time and ms/product (~1 s currently).

---

## 🧱 Architecture

### Adapter API

```ts
interface PriceAdapter {
  name: string;
  enabled: boolean;
  canHandle(url: string): boolean;
  extractData(
    html: string,
    customSelector?: string
  ): Promise<ExtractedProductData>;
  generateAffiliateUrl(url: string): string;
}
```

`src/adapters/registry.ts` exposes helper APIs (`getAdapterForUrl`, `getTierInfo`, `getBadgeInfo`, `isSupportedSite`) for both the service worker and content script.

### Storage & Rate Limiting

- One Chrome storage key per product (`product_<id>`); rate-limit buckets stored as `rateLimit_<domain>`.
- `StorageManager.migrateLegacyFormat` moves old aggregated data (`priceTrackerData`) into individual keys.
- Rate limiting uses exponential backoff persisted per domain (1m/5m/30m/120m).

### Execution

- `PriceChecker.checkAllProducts` runs serially with `sleep(1000)` between products; good enough today, benchmark ensures we know the cost (~50 products ≈ 50 seconds).
- Hooks call `updatePriceInBackend` asynchronously; manual tracking persists selectors + store names for future runs.

---

## 🛠 Tech Stack

- TypeScript (strict)
- esbuild (ESM bundles)
- linkedom (HTML parsing in service worker)
- Chart.js (popup charts)
- Vitest + jsdom (testing + coverage)
- Firebase SDK (optional backend)

---

## 📁 Project Layout

```
src/
├── adapters/             # specific adapters + enhanced/generic/stub + registry
├── backend/              # Firebase helpers
├── core/                 # PriceChecker, StorageManager, RateLimiter, NotificationManager
├── config/               # supported sites + ENV helpers
├── popup/                # popup logic, styles, HTML
├── utils/                # htmlParser, metadataExtractor, priceParser, logger, date utils
├── content-script.ts     # injects button + price picker orchestration
├── service-worker.ts     # background message router + tracking flows
└── manifest.json         # MV3 config
```

Docs: `docs/README.md`, `docs/README-ADAPTERS.md`, `docs/GENERIC_ADAPTER_GUIDE.md`, `docs/FIREBASE_SETUP.md`, `auditoria*.md` (audit reports), plus targeted bug-fix notes in `docs/BUG_FIX_*`.

---

## 🧪 Testing

| Command                                                                                    | Description                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `npm run lint`                                                                             | ESLint on `src/` + `tests/` with autofix.                                 |
| `npm test`                                                                                 | Vitest suite (unit + integration).                                        |
| `npm run test:coverage`                                                                    | Coverage report + enforcement (≥60% lines/branches/functions/statements). |
| `PRICECHECKER_PERF=true npx vitest run tests/performance/priceChecker.performance.test.ts` | Sequential performance benchmark (~1 s/product).                          |
| `npm run ci`                                                                               | Lint → `tsc --noEmit` → tests → build (CI parity).                        |

Chrome APIs are mocked in `src/test/setup.ts`. Coverage artifacts live in `coverage/`.

---

## 🔐 Release Checklist

1. `npm run build`
2. Audit bundled credentials:
   ```bash
   rg -n "FIREBASE" dist/popup/popup.js dist/service-worker.js
   rg -n "AFFILIATE" dist/popup/popup.js
   ```
   Current production builds include `pricewatch-21` (Amazon) and Firebase project `price-history-tracker-34724`; replace/mask before publishing if needed.
3. Verify `dist/manifest.json` host permissions/content script matches.
4. Zip `dist/` and upload to the Chrome Web Store.

---

## 📝 Environment Variables

Copy `.env.example` → `.env` and fill only what you need (empty strings are OK):

```
AFFILIATE_AMAZON_TAG=
AFFILIATE_EBAY_ID=
AFFILIATE_ADMITAD_ID=

FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
```

esbuild injects these values via `define`, so the runtime never touches `process.env`.

---

## 🤝 Contributing

1. Fork & clone the repo.
2. `npm install`
3. Run `npm run lint && npm test`.
4. Add/adapt adapters and logic with accompanying tests.
5. Open a PR referencing any related audit/task.

---

## 📄 License

MIT — see [LICENSE](LICENSE).

---

## 📬 Support

Please open an issue for bugs, adapter requests, or questions about manual tracking/build steps.
