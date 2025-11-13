# Adding a New Adapter

This guide shows how to add support for a new e-commerce platform.

## Overview

The adapter pattern allows easy extension to new platforms. Each adapter:
- Implements the `PriceAdapter` interface
- Parses HTML **using `createDocument` (linkedom)** — never `DOMParser` inside the service worker
- Extracts metadata (title/image) directly del DOM real
- Generates affiliate URLs (via placeholders declarados en `.env`)
- Is auto-discovered by the registry + tier system

> ℹ️ Actualmente tenemos adapters específicos para **Amazon, eBay, AliExpress, PcComponentes y MediaMarkt**. Usa cualquiera de ellos como referencia.

## Step-by-Step Guide

### 1. Create Adapter File

Create `src/adapters/implementations/yourplatform.adapter.ts`:

```typescript
import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';
import { logger } from '../../utils/logger';
import { createDocument } from '../../utils/htmlParser';

export class YourPlatformAdapter implements PriceAdapter {
  name = 'yourplatform';
  affiliateNetworkId = 'network-name';
  enabled = true;
  urlPatterns = [
    /yourplatform\.com\/product\//i,
    /yourplatform\.es\/producto\//i,
  ];

  canHandle(url: string): boolean {
    return this.urlPatterns.some(pattern => pattern.test(url));
  }

  async extractData(html: string): Promise<ExtractedProductData> {
    try {
      const doc = createDocument(html);

      // Extract title
      const title = this.extractTitle(doc);
      if (!title) {
        return {
          title: 'Product',
          price: 0,
          currency: 'EUR',
          available: false,
          error: 'Title not found',
        };
      }

      // Extract price
      const priceData = this.extractPrice(doc);
      if (!priceData) {
        return {
          title,
          price: 0,
          currency: 'EUR',
          available: false,
          error: 'Price not found',
        };
      }

      // Extract image (optional)
      const imageUrl = this.extractImage(doc);

      return {
        title,
        price: priceData.price,
        currency: priceData.currency,
        imageUrl,
        available: true,
      };
    } catch (error) {
      logger.error('YourPlatform extraction failed', error);
      return {
        title: 'Product',
        price: 0,
        currency: 'EUR',
        available: false,
        error: error instanceof Error ? error.message : 'Extraction failed',
      };
    }
  }

  generateAffiliateUrl(url: string): string {
    // Usa variables inyectadas via esbuild.define (ver src/config/env.ts)
    // Ejemplo:
    // return addQueryParam(url, 'tag', ENV.AFFILIATE_YOURPLATFORM_ID ?? '');
    return url;
  }

  private extractTitle(doc: Document): string | null {
    const selectors = [
      'h1.product-title',
      '.product-name',
      '[data-testid="product-title"]',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  private extractPrice(doc: Document): { price: number; currency: string } | null {
    const selectors = [
      '.product-price',
      '[data-testid="price"]',
      '.price-value',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent) {
        const text = element.textContent.trim();
        const price = this.parsePrice(text);
        if (price > 0) {
          const currency = this.detectCurrency(text);
          return { price, currency };
        }
      }
    }

    return null;
  }

  private extractImage(doc: Document): string | undefined {
    const selectors = [
      '.product-image img',
      '[data-testid="product-image"]',
      '.main-image',
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector) as HTMLImageElement;
      if (element?.src) {
        return element.src;
      }
    }

    return undefined;
  }

  private parsePrice(text: string): number {
    const cleaned = text
      .replace(/[€$£¥]/g, '')
      .replace(/\s/g, '')
      .replace(/,/g, '.');
    
    const match = cleaned.match(/\d+\.?\d*/);
    return match ? parseFloat(match[0]) : 0;
  }

  private detectCurrency(text: string): string {
    if (text.includes('€')) return 'EUR';
    if (text.includes('$')) return 'USD';
    if (text.includes('£')) return 'GBP';
    return 'EUR';
  }
}
```

### 2. Register Adapter

Add to `src/adapters/registry.ts`:

```typescript
import { YourPlatformAdapter } from './implementations/yourplatform.adapter';

const adapters: PriceAdapter[] = [
  new AmazonAdapter(),
  new EbayAdapter(),
  new AliExpressAdapter(),
  new YourPlatformAdapter(), // ← Add here
  // ...
];
```

### 3. Update Manifest

Add URL patterns to `src/manifest.json`:

```json
{
  "host_permissions": [
    "https://www.yourplatform.com/*",
    "https://www.yourplatform.es/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://www.yourplatform.com/*",
        "https://www.yourplatform.es/*"
      ],
      "js": ["content-script.js"],
      "run_at": "document_idle"
    }
  ]
}
```

### 4. Add Environment Variable

Add to `.env.example`:

```env
AFFILIATE_YOURPLATFORM_ID=
```

### 5. Test

1. Rebuild: `npm run build`
2. Reload extension in Chrome
3. Visit a product page on your platform
4. Click "Track Price"
5. Verify data extracted correctly

## Finding Selectors

### Method 1: Chrome DevTools

1. Right-click element → Inspect
2. Note the selector (class, id, data attribute)
3. Test in Console: `document.querySelector('.your-selector')`

### Method 2: Network Tab

1. Open DevTools → Network
2. Reload product page
3. Find HTML response
4. Search for price/title text
5. Identify surrounding HTML structure

### Method 3: View Source

1. Right-click page → View Page Source
2. Search for price (e.g., "29.99")
3. Note parent elements and classes

## Best Practices

### Multiple Selectors

Always provide fallback selectors:

```typescript
const selectors = [
  '.new-selector',      // Current design
  '.old-selector',      // Legacy design
  '[data-price]',       // Data attribute
  '#price-element',     // ID fallback
];
```

### Error Handling

Return structured errors, don't throw:

```typescript
if (!title) {
  return {
    title: 'Product',
    price: 0,
    currency: 'EUR',
    available: false,
    error: 'Title not found',
  };
}
```

### Currency Detection

Support multiple currencies:

```typescript
private detectCurrency(text: string): string {
  if (text.includes('€') || text.includes('EUR')) return 'EUR';
  if (text.includes('$') || text.includes('USD')) return 'USD';
  if (text.includes('£') || text.includes('GBP')) return 'GBP';
  if (text.includes('¥') || text.includes('JPY')) return 'JPY';
  return 'EUR'; // Default
}
```

### Price Parsing

Handle various formats:

```typescript
// "29.99 €" → 29.99
// "$29,99" → 29.99
// "29,99 EUR" → 29.99
private parsePrice(text: string): number {
  const cleaned = text
    .replace(/[€$£¥]/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '.');
  
  const match = cleaned.match(/\d+\.?\d*/);
  return match ? parseFloat(match[0]) : 0;
}
```

## Testing Your Adapter

### Unit Test Template

Create `tests/adapters/yourplatform.test.ts`:

```typescript
import { YourPlatformAdapter } from '../../src/adapters/implementations/yourplatform.adapter';

describe('YourPlatformAdapter', () => {
  const adapter = new YourPlatformAdapter();

  test('canHandle returns true for valid URLs', () => {
    expect(adapter.canHandle('https://yourplatform.com/product/123')).toBe(true);
    expect(adapter.canHandle('https://amazon.com/dp/123')).toBe(false);
  });

  test('extractData parses HTML correctly', async () => {
    const html = `
      <html>
        <h1 class="product-title">Test Product</h1>
        <span class="product-price">29.99 €</span>
      </html>
    `;

    const result = await adapter.extractData(html);
    
    expect(result.title).toBe('Test Product');
    expect(result.price).toBe(29.99);
    expect(result.currency).toBe('EUR');
    expect(result.available).toBe(true);
  });

  test('generateAffiliateUrl adds affiliate ID', () => {
    process.env.AFFILIATE_YOURPLATFORM_ID = 'test-id';
    const url = 'https://yourplatform.com/product/123';
    const result = adapter.generateAffiliateUrl(url);
    
    expect(result).toContain('test-id');
  });
});
```

### Manual Testing

1. **Track Product**: Visit product page, click "Track Price"
2. **Check Storage**: `chrome.storage.sync.get('priceTrackerData', console.log)`
3. **Verify Data**: Title, price, currency correct
4. **Test Updates**: Wait for price check, verify updates work
5. **Test Affiliate**: Click "View" in popup, verify URL has affiliate params

## Common Issues

### Selector Not Found

**Problem**: Element not found with selector

**Solution**: 
- Check if page uses dynamic rendering (React, Vue)
- Wait for element: `await new Promise(r => setTimeout(r, 1000))`
- Use more generic selectors

### Price Parsing Fails

**Problem**: Price extracted as 0 or NaN

**Solution**:
- Log raw text: `console.log('Raw price text:', text)`
- Check for hidden characters
- Handle different decimal separators (`.` vs `,`)

### Image Not Loading

**Problem**: Image URL is relative or broken

**Solution**:
```typescript
private extractImage(doc: Document): string | undefined {
  const img = doc.querySelector('.product-image') as HTMLImageElement;
  if (img?.src) {
    // Convert relative to absolute
    return new URL(img.src, window.location.href).toString();
  }
  return undefined;
}
```

## Stub Adapters

For platforms not yet implemented, create a stub:

```typescript
export class FuturePlatformAdapter implements PriceAdapter {
  name = 'futureplatform';
  affiliateNetworkId = 'network';
  enabled = false; // 🟡 Disabled until implemented
  urlPatterns: RegExp[] = [];

  canHandle(_url: string): boolean {
    return false;
  }

  async extractData(_html: string): Promise<ExtractedProductData> {
    return {
      title: 'Product',
      price: 0,
      currency: 'EUR',
      available: false,
      error: 'FuturePlatform adapter not implemented yet',
    };
  }

  generateAffiliateUrl(url: string): string {
    // TODO: Implement affiliate URL generation
    return url;
  }
}
```

## Checklist

Before submitting your adapter:

- [ ] Implements `PriceAdapter` interface
- [ ] Has 3+ fallback selectors for each field
- [ ] Handles errors gracefully (no throws)
- [ ] Supports multiple currencies
- [ ] Parses prices correctly (decimal handling)
- [ ] Generates affiliate URLs
- [ ] Added to registry
- [ ] Updated manifest.json
- [ ] Added environment variable
- [ ] Tested on real product pages
- [ ] Documented in README

## Need Help?

- Check existing adapters (Amazon, eBay, AliExpress) for examples
- Open an issue on GitHub
- Join our Discord community

Happy coding! 🚀
