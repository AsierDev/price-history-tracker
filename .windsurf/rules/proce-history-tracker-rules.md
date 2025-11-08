---
trigger: always_on
---

# Price History Tracker - Windsurf Rules

This file extends global rules for the Chrome Extension scaffold project.

---

## Project Context

- **Type**: Chrome Extension (Manifest V3)
- **Tech Stack**: TypeScript + esbuild
- **Status**: MVP scaffold (complete, single generation)
- **Quality Bar**: Production-ready, zero manual fixes expected

---

## Architecture Principles

### Feature-Based Structure

- Organize by feature (adapters, core, popup), not by layer type.
- Each adapter is **self-contained** and independently testable.
- `src/shared/` only for truly cross-cutting utilities.

### Adapter Pattern (Critical)

- **Single responsibility**: Each adapter handles one platform.
- **Interface contract**: All adapters implement `PriceAdapter`.
- **Registry pattern**: Central `registry.ts` discovers adapters dynamically.
- **Easy to extend**: Adding a new platform = 1 new file + 1 import.

### Chrome Extension Specifics

- **Content scripts**: Isolated context; inject UI only, no heavy logic.
- **Service Worker**: Stateless orchestrator; all state in Chrome Storage Sync.
- **Popup**: Pure UI layer; reads from Storage, sends messages to Worker.
- **No DOM manipulation outside content-script**: Keep concerns separate.

---

## Code Standards

### TypeScript

- **Strict mode**: `strict: true` in tsconfig.
- **No `any`**: Use `unknown` + type guards or refactor.
- **Exports**: Named exports (not default) for easier refactoring.
- **Interfaces for contracts**: Define `PriceAdapter`, `TrackedProduct`, `ExtensionConfig` clearly.

### Naming Conventions

- **Adapters**: `{platform}.adapter.ts` (e.g., `amazon.adapter.ts`)
- **Hooks/Utils**: `use{Name}` or `{name}Utils`
- **Types**: `{Name}Schema` (Zod) or `{Name}Type` (TypeScript)
- **Constants**: `SCREAMING_SNAKE_CASE`

### Error Handling

- **Explicit try-catch** in async functions.
- **User-facing errors**: Clear messages, no stack traces in UI.
- **Network errors**: Log with context (domain, retry count, timestamp).
- **Adapter failures**: Return `{ available: false, error: "reason" }`, not throw.

---

## Implementation Details

### Storage Strategy

- **Chrome Storage Sync**: MVP only (100KB limit, ~50 products fit easily).
- **Structure**: `{ products, rateLimitBuckets, config, lastCheckTime }`.
- **No mutations**: Always read → update → write back.
- **Versioning hooks**: Leave `v1`, `v2` migration comments for future.

### Rate Limiting (Backoff Strategy)

- **Exponential backoff**: 1m → 5m → 30m → 2h per domain failure.
- **Serial MVP**: 1 product/sec; no parallelization in this version.
- **Hooks for parallelism**: Add `// TODO: enableParallel()` for future.

### Adapters: Scraping Rules

- **DOMParser only**: No Cheerio, jsdom, or external libs.
- **Multiple selectors**: Try 3-4 common patterns per site (they change).
- **Fallback gracefully**: If title missing, use "Product"; if price fails, mark unavailable.
- **Affiliate URLs**: Generate at runtime using env vars, never hardcode.

---

## Testing & Verification

### Manual Testing Checklist

1. `npm install` → no errors
2. `npm run build` → `dist/` compiles without warnings
3. Load in `chrome://extensions` → appears as extension
4. Navigate Amazon/eBay/AliExpress → "Track Price" button injects
5. Click button → product appears in popup with correct data
6. Modify product price in Storage (devtools) → Service Worker detects
7. Price drop >5% → notification fires with correct buttons
8. Dark mode toggle → persists across popup closes
9. Reach 50 products → error message shown, no add
10. Remove button → deletes and UI updates instantly

### Code Quality Gates

- **No ESLint warnings**: Run `npm run lint --fix`
- **Type strict**: `tsc --noEmit` passes
- **No unused vars**: Enforce in tsconfig
- **Comments only for WHY**: Logic should be self-documenting

---

## Security & Constraints

### No External Dependencies for Core

- Fetch only (native).
- DOMParser only.
- Chrome APIs only.
- No Puppeteer, jsdom, or scraping libs.

### Affiliate URLs

- **Structure-only MVP**: Generate URLs but don't monetize yet.
- **All IDs in `.env`**: Never hardcode, never commit real values.
- **Validation**: Ensure URL is valid before passing to affiliate network.

### Rate Limiting is Non-Negotiable

- **Amazon/eBay ban bots**: This is your only defense.
- **Log failures with domain**: Track which sites are problematic.
- **Fail gracefully**: User sees "Retrying..." not crashes.

---

## File Generation Checklist

Cascade MUST generate exactly:

**Core**:

- `src/core/types.ts` — All interfaces (TrackedProduct, PriceAdapter, etc)
- `src/core/storage.ts` — Chrome Storage wrapper (CRUD for products)
- `src/core/priceChecker.ts` — Serial orchestration + comparison logic
- `src/core/rateLimiter.ts` — Backoff exponential per domain
- `src/core/notificationManager.ts` — Chrome Notifications wrapper

**Adapters**:

- `src/adapters/types.ts` — PriceAdapter interface
- `src/adapters/registry.ts` — Factory (getAdapterForUrl)
- `src/adapters/implementations/{amazon,ebay,aliexpress}.adapter.ts` — ✅ Full
- `src/adapters/implementations/{tradetracker,belboon,awin}.adapter.ts` — 🟡 Stubs (enabled: false)

**UI/Background**:

- `src/popup/{popup.html, popup.ts, styles.css}` — Popup UI + logic
- `src/content-script.ts` — Injects "Track Price" button
- `src/service-worker.ts` — Alarms + orchestration

**Config**:

- `src/manifest.json` — Manifest V3 (all permissions listed)
- `package.json` — Scripts: dev, build, watch, lint
- `tsconfig.json` — Strict mode, path aliases
- `esbuild.config.js` — Build config (copies static, bundles .ts)
- `.env.example` — All affiliate placeholders

**Docs**:

- `docs/README.md` — Setup, testing, folder structure
- `docs/README-ADAPTERS.md` — How to add new adapter (step-by-step)

**Utilities**:

- `src/utils/{logger,dateUtils,urlUtils}.ts`

---

## Common Pitfalls to Avoid

| ❌ Pitfall                   | ✅ Solution                                        |
| ---------------------------- | -------------------------------------------------- |
| Hardcoded affiliate IDs      | Use `.env`, generate at runtime                    |
| Mixed async/await logic      | Extract to service, keep Worker simple             |
| No error context in logs     | Include domain, timestamp, retry count             |
| Adapter extractors throw     | Return `{ available: false, error: "..." }`        |
| Storage mutations            | Always: read → clone → update → write              |
| No rate limiting hooks       | Serial now, but comment where parallelism would go |
| CSS hardcoded colors         | Use CSS variables for light/dark                   |
| Storage read race conditions | Always await `StorageManager.getData()`            |

---

## Deliverables

1. **Full scaffolding** in `dist/` ready for `chrome://extensions`
2. **Zero manual fixes** — all files generated in first pass
3. **docs/README.md** with exact test steps
4. **docs/README-ADAPTERS.md** with template for new adapters
5. **.env.example** with all placeholders clearly marked

---

**Constraint**: No iterations. All code must compile and run first time.
