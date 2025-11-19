# Adapter Development Guide

Use this guide to add support for a new e-commerce platform.

## Overview

Every adapter must:

- Extend the `BaseAdapter` class and implement its abstract methods.
- Parse HTML via `createDocument` (linkedom) – never `DOMParser`.
- Extract product metadata (title, price, currency, optional image) and return structured errors.
- Generate affiliate URLs when applicable (values injected via `src/config/env.ts`).
- Register itself in `src/adapters/registry.ts` so the tier system can discover it.

Existing adapters (Amazon, eBay, AliExpress, PC Componentes, MediaMarkt, El Corte Inglés) extend `BaseAdapter` and are good reference points. Stub-only adapters (Awin, Belboon, TradeTracker) now extend `StubAdapter` and can be upgraded when real integrations are ready.

## 1. Create the adapter

`src/adapters/implementations/<platform>.adapter.ts`

```ts
import { BaseAdapter } from '../base/BaseAdapter';
import type { ExtractedProductData } from '../../core/types';
import { logger } from '../../utils/logger';
import { createDocument } from '../../utils/htmlParser';
import { parsePrice, detectCurrency } from '../../utils/priceUtils';

export class YourPlatformAdapter extends BaseAdapter {
  name = 'yourplatform';
  affiliateNetworkId = 'your-network';
  enabled = true;
  urlPatterns = [/yourplatform\.com\/product\//i];

  canHandle(url: string): boolean {
    return this.urlPatterns.some(pattern => pattern.test(url));
  }

  protected extractTitle(doc: Document): string | null {
    const selectors = ['h1.product-title', '.product-name', '[data-testid="product-title"]'];
    for (const selector of selectors) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) return text;
    }
    return doc.title?.trim() ?? null;
  }

  protected extractPrice(doc: Document): number {
    const selectors = ['.product-price', '[data-price]', '.price-value'];
    for (const selector of selectors) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (!text) continue;
      const price = parsePrice(text);
      if (price > 0) return price;
    }
    return 0;
  }

  protected extractCurrency(doc: Document): string {
    const selectors = ['.product-price', '[data-price]', '.price-value'];
    for (const selector of selectors) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) {
        const currency = detectCurrency(text);
        if (currency) return currency;
      }
    }
    return 'EUR';
  }

  protected extractImage(doc: Document): string | undefined {
    const og = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (og) return og;
    const img = doc.querySelector('.product-image img, img[itemprop="image"]') as HTMLImageElement | null;
    return img?.src;
  }

  generateAffiliateUrl(url: string): string {
    // Example: append query param using values from ENV (see src/config/env.ts)
    return url;
  }
}
```

**Note**: `BaseAdapter` provides the `extractData` template method that calls your `extractTitle`, `extractPrice`, `extractCurrency`, and optionally `extractImage`. You just need to implement these abstract/protected methods.

## 2. Register in the adapter registry

`src/adapters/registry.ts`

```ts
import { YourPlatformAdapter } from './implementations/yourplatform.adapter';

const specificAdapters: PriceAdapter[] = [
  new AmazonAdapter(),
  new EbayAdapter(),
  new AliExpressAdapter(),
  new YourPlatformAdapter(),
  genericAdapter,
];
```

Adapters are evaluated in array order. Place niche adapters after high-traffic ones unless a domain overlap requires otherwise.

## 3. Update permissions (if needed)

If the extension only needs existing host permissions (`https://*/*`, `http://*/*`), no change is required. Otherwise add your domains to `host_permissions` and `content_scripts.matches` in `src/manifest.json`.

## 4. Add environment variables (optional)

If the adapter requires unique affiliate IDs, add placeholders in `.env.example` and expose them through `src/config/env.ts` getters.

Example:

```
AFFILIATE_YOURPLATFORM_ID=
```

## 5. Tests

- Add unit tests in `tests/adapters/<platform>.adapter.test.ts`.
- Mock HTML samples and ensure `extractData` returns expected structures.
- Verify `canHandle` only accepts real product URLs.
- Add integration coverage if the adapter requires special behavior.

Example snippet:

```ts
import { describe, expect, it } from 'vitest';
import { YourPlatformAdapter } from '@adapters/implementations/yourplatform.adapter';

describe('YourPlatformAdapter', () => {
  const adapter = new YourPlatformAdapter();

  it('matches supported URLs', () => {
    expect(adapter.canHandle('https://yourplatform.com/product/123')).toBe(true);
    expect(adapter.canHandle('https://example.com/')).toBe(false);
  });

  it('extracts title and price', async () => {
    const html = `
      <html>
        <h1 class="product-title">Test Product</h1>
        <span class="product-price">29,99 €</span>
      </html>`;
    const result = await adapter.extractData(html);
    expect(result.title).toBe('Test Product');
    expect(result.price).toBe(29.99);
    expect(result.currency).toBe('EUR');
  });
});
```

## 6. Manual QA checklist

1. Build & reload extension.
2. Open a product on the new platform.
3. Confirm the floating CTA appears and “Track Price” succeeds.
4. Verify the popup displays the correct title, price, currency, and badge.
5. Trigger a manual check (🔄) to ensure `PriceChecker` reuses the adapter correctly.
6. Click “View” to confirm the affiliate URL is generated as expected.

## 7. Best practices

- Provide multiple CSS selectors for resilience (new vs. legacy layouts).
- Sanitize prices using helper functions (`parsePrice`, `detectCurrency`) instead of ad-hoc regexes.
- Return informative errors so the popup/service worker can log actionable messages.
- Keep adapters idempotent: no side effects beyond parsing and affiliate URL generation.
- Aim for deterministic tests by mocking HTML instead of relying on live network calls.

## 8. Generic adapter & manual picker internals

Even if you focus on Tier‑1 adapters it helps to understand how the universal fallback works. The manual picker and `GenericAdapter` share the same primitives you can reuse in niche adapters.

### 8.1 User + data flow

```
Unsupported site → content script shows 📍 CTA
    ↓ click
Price picker overlay highlights DOM nodes, validates "looks like a price"
    ↓ confirm
Service worker receives { selector, text }, parses via parseGenericPrice()
    ↓
GenericAdapter stores selector + storeName metadata
    ↓
PriceChecker reuses selector on future fetches
```

- Products created this way carry `adapter: 'generic'` and `customSelector`.
- Popup badges show the detected store name (metadata extractor) plus a 🎯 icon when a selector is stored.
- If the selector stops matching, `PriceChecker` logs a warning; users can re-track to capture a new selector.

### 8.2 Price picker essentials

- Overlay with crosshair cursor, tooltip, ESC to cancel.
- Selector priority: `#id` → price-specific classes → data attributes → combined classes → fallback DOM path (`nth-child`).  
- Validation: `looksLikePrice()` checks currency symbols + numeric patterns before accepting a selection. Reuse this helper for your own adapters if you allow user-provided selectors.

### 8.3 Parsing helpers

- `parseGenericPrice(text)` handles USD/EUR/GBP/JPY and most LATAM/EU formats (`1.299,99 €`, `$1,299.99`, etc.).
- `extractPriceFromHTML(html, selector)` is available when you already know the CSS selector (used by `GenericAdapter` during rechecks).
- Use `detectCurrency`/`parsePrice` from `src/utils/priceUtils.ts` in new adapters instead of writing custom regexes.

### 8.4 Data contracts

```ts
interface TrackedProduct {
  id: string;
  title: string;
  url: string;
  currentPrice: number;
  initialPrice: number;
  currency: string;
  adapter: string;          // 'generic' for manual products
  customSelector?: string;  // present only for manual entries
  storeName?: string;
  addedAt: number;
  lastCheckedAt: number;
  isActive: boolean;
}
```

Manual tracking sends:

```ts
chrome.runtime.sendMessage({
  action: 'trackProductManual',
  url,
  priceElement: { selector: '.price-main', text: '$29.99' },
  metadata: { title, imageUrl, storeName },
});
```

### 8.5 Error handling & limitations

- Always return structured `{ available: false, error: '...' }` responses; do not throw inside adapters.
- If a selector fails (site redesign), surface a warning but keep the product so the user can reselect.
- Manual tracking can’t infer affiliate URLs and depends on site stability—set expectations accordingly in user-facing copy.
- Dynamic SPA sites might require waiting for hydration; consider injecting small delays or targeting static selectors when building adapters for such stacks.

### 8.6 Testing manual scenarios

- Run `PRICECHECKER_PERF=true ...` to ensure manual products don’t regress performance (serial ~1 s/product).
- Add integration tests that mock `trackProductManual` messages if your adapter builds on top of the manual picker.
- Manual QA: Etsy/Shopify example, select price, reload page, trigger manual check, verify selector still works.
