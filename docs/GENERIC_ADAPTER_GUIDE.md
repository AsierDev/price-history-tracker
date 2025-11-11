# Generic Adapter - Universal Price Tracker Guide

## Overview

The **Generic Adapter** is a universal price tracking system that allows users to track products from **any website**, not just Amazon, eBay, and AliExpress. Unlike specific adapters that automatically extract prices, the Generic Adapter uses **manual price selection** through a visual picker interface.

## Key Features

✅ **Universal Coverage**: Works on any e-commerce site (Etsy, Walmart, Shopify stores, etc.)  
✅ **Visual Price Picker**: User clicks on the price element visually  
✅ **Automatic Price Parsing**: Supports multiple currencies (USD, EUR, GBP, JPY, CAD, AUD, etc.)  
✅ **Automatic Checks**: Once configured, tracks price changes automatically  
✅ **Selector Resilience**: Generates robust CSS selectors for future checks  

## How It Works

### 1. User Flow

```
User visits unsupported site (e.g., Etsy.com)
    ↓
"Track Price (Manual)" button appears on page
    ↓
User clicks button
    ↓
Price Picker activates (crosshair cursor + overlay)
    ↓
User hovers over elements → highlights and shows preview
    ↓
User clicks on price element
    ↓
Extension validates it looks like a price
    ↓
If valid: Creates product with custom selector
    ↓
Future checks use the same selector to extract price
```

### 2. Technical Architecture

```
┌─────────────────────────────────────────────────┐
│  Content Script (content-script.ts)             │
│  - Detects unsupported sites                    │
│  - Injects "Track Price (Manual)" button        │
│  - Activates PricePicker on click               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Price Picker (pricePicker.ts)                  │
│  - Visual element selection UI                  │
│  - Highlights elements on hover                 │
│  - Generates unique CSS selectors               │
│  - Validates price format                       │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Service Worker (service-worker.ts)             │
│  - Receives selector + text from picker         │
│  - Parses price using parseGenericPrice()       │
│  - Extracts page title & image (optional)       │
│  - Saves product with customSelector field      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Generic Adapter (generic.adapter.ts)           │
│  - Fallback adapter (canHandle: always true)    │
│  - Requires customSelector for extraction       │
│  - Uses parseGenericPrice for parsing           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Price Checker (priceChecker.ts)                │
│  - Passes customSelector to extractData()       │
│  - Handles broken selectors gracefully          │
│  - Updates price if changed                     │
└─────────────────────────────────────────────────┘
```

## Components

### 1. Generic Adapter (`generic.adapter.ts`)

**Properties:**
- `name: 'generic'`
- `enabled: true`
- `requiresManualSelection: true`
- `urlPatterns: [/.*/]` (matches everything)

**Methods:**
- `canHandle(url)`: Always returns `true` (fallback)
- `extractData(html, customSelector)`: Extracts price using custom selector
- `generateAffiliateUrl(url)`: Returns original URL (no affiliate support)

**Key Features:**
- Requires `customSelector` parameter
- Returns error if no selector provided
- Extracts title from `<title>` or `<h1>`
- Tries to extract image from Open Graph meta tags

### 2. Price Parser (`priceParser.ts`)

**Functions:**

#### `parseGenericPrice(text: string): ParsedPrice | null`

Extracts price from arbitrary text containing currency and numbers.

**Supported Formats:**
- US: `$29.99`, `$1,299.99`, `29.99 USD`
- EU: `€29,99`, `€1.299,99`, `29,99 EUR`
- UK: `£19.99`, `19.99 GBP`
- Japan: `¥2999`, `2999 JPY`
- Other: `CAD`, `AUD`, `CHF`, `INR`, `RUB`, etc.

**Examples:**
```typescript
parseGenericPrice('$29.99')           // { price: 29.99, currency: 'USD' }
parseGenericPrice('€1.299,99')        // { price: 1299.99, currency: 'EUR' }
parseGenericPrice('Price: £19.95')    // { price: 19.95, currency: 'GBP' }
parseGenericPrice('¥2999')            // { price: 2999, currency: 'JPY' }
```

#### `looksLikePrice(text: string): boolean`

Validates if text contains a price (currency symbol + number).

**Usage:**
```typescript
looksLikePrice('$29.99')        // true
looksLikePrice('Just text')     // false
```

#### `extractPriceFromHTML(html: string, selector: string): ParsedPrice | null`

Extracts price from HTML using CSS selector.

### 3. Price Picker (`pricePicker.ts`)

**Visual Interface:**
- **Overlay**: Semi-transparent backdrop with crosshair cursor
- **Banner**: Instructions at top ("Click on the price element")
- **Tooltip**: Follows mouse, shows element text preview and validation status
- **Highlight**: Blue outline on hovered element

**Selector Generation Priority:**
1. ID (`#price-element`)
2. Price-related classes (`.price`, `.cost`, `.amount`)
3. Class combination (`.product-info.price-main`)
4. DOM path with nth-child (`div > span:nth-child(2)`)

**Validation:**
- Ensures selector is unique (matches only 1 element)
- Validates text looks like a price
- Shows error if invalid selection

**Controls:**
- **Hover**: Highlight element and show preview
- **Click**: Select element (if valid)
- **ESC**: Cancel picker mode

## Usage Examples

### Example 1: Etsy Product

```javascript
// User visits: https://www.etsy.com/listing/123456789/handmade-lamp

1. Content script injects "📍 Track Price (Manual)" button
2. User clicks button
3. Price picker activates
4. User clicks on "$45.99"
5. Extension creates product:
   {
     title: "Handmade Ceramic Lamp | Etsy",
     price: 45.99,
     currency: "USD",
     adapter: "generic",
     customSelector: ".price-main",
     url: "https://www.etsy.com/listing/123456789/handmade-lamp"
   }
6. Future checks use `.price-main` selector
```

### Example 2: Shopify Store

```javascript
// User visits: https://mystore.shopify.com/products/cool-product

1. User selects price: "€129,99"
2. Extension generates selector: ".product-price span.money"
3. Parser extracts: { price: 129.99, currency: "EUR" }
4. Product saved with custom selector
5. Automatic checks every 6 hours using same selector
```

## Data Structure

### TrackedProduct (with Generic Adapter)

```typescript
{
  id: "1699624892345-abc123def",
  title: "Product from Etsy",
  url: "https://etsy.com/listing/123",
  currentPrice: 45.99,
  initialPrice: 45.99,
  currency: "USD",
  adapter: "generic",
  customSelector: ".price-main", // ← Special field for generic products
  addedAt: 1699624892345,
  lastCheckedAt: 1699624892345,
  isActive: true
}
```

### Message Types

**Manual Tracking Message:**
```typescript
{
  action: 'trackProductManual',
  url: 'https://example.com/product',
  priceElement: {
    selector: '.price-main',
    text: '$29.99'
  }
}
```

## Error Handling

### Broken Selector

If a website changes structure and selector no longer works:

```typescript
// Price Checker detects broken selector
if (product.adapter === 'generic' && !data.available) {
  logger.warn('Generic product price element not found - selector may be broken', {
    productId: product.id,
    selector: product.customSelector
  });
  // Future: Show "Re-select Price" button in popup
}
```

### Invalid Price Selection

```typescript
// User selects element without price
if (!looksLikePrice(selectedText)) {
  showError('This doesn't look like a price. Please select the price element.');
  // Picker stays active, user can try again
}
```

## Limitations

⚠️ **Known Limitations:**

1. **Dynamic Sites**: React/Vue sites with client-side rendering may have unstable selectors
2. **Selector Breakage**: Website redesigns can break custom selectors
3. **No Automatic Title/Image**: Generic extraction is less accurate than specific adapters
4. **Slower Checks**: Requires fetching and parsing full HTML (vs. API)
5. **No Affiliate URLs**: Generic adapter doesn't support affiliate programs

## Testing

### Unit Tests

```bash
# Run generic adapter tests
npm test tests/adapters/generic.test.ts

# Run price parser tests
npm test tests/utils/priceParser.test.ts
```

### Manual Testing Checklist

- [ ] Visit unsupported site (e.g., Etsy)
- [ ] "Track Price (Manual)" button appears
- [ ] Click button → picker activates
- [ ] Hover over elements → highlights visible
- [ ] Tooltip shows text preview
- [ ] Click on price → validation passes
- [ ] Product appears in popup with "📍 Generic (Manual)" label
- [ ] Selector badge (🎯) visible with tooltip showing selector
- [ ] ESC key cancels picker
- [ ] Invalid selection shows error
- [ ] Price check works in background

## Best Practices

### For Users

1. **Select the main price element**: Avoid selecting sale prices or old prices
2. **Check the tooltip**: Ensure it shows ✅ "Looks like a price"
3. **Test immediately**: Open popup to verify product was added correctly
4. **Re-select if broken**: If checks fail, re-select the price element

### For Developers

1. **Validate before saving**: Always check `looksLikePrice()` before accepting selection
2. **Generate robust selectors**: Use IDs and price-specific classes when possible
3. **Handle broken selectors gracefully**: Don't crash, log warning and continue
4. **Test with multiple currencies**: Ensure parser handles EUR, GBP, JPY, etc.

## Future Enhancements

🚀 **Planned Features:**

- [ ] **Re-selection UI**: Button in popup to re-select broken price elements
- [ ] **Selector validation**: Test selector on multiple pages before saving
- [ ] **Price history comparison**: Show history from other users (backend)
- [ ] **OCR support**: Extract prices from images
- [ ] **Auto-selector discovery**: ML to suggest best selector

## Summary

The Generic Adapter transforms this extension from a **platform-specific tracker** (Amazon, eBay, AliExpress) to a **universal price tracker** that works on **any e-commerce site**.

**Key Achievement**: Infinite scalability without writing new adapters.

**Files Created/Modified:**
- ✅ `src/utils/priceParser.ts` (new)
- ✅ `src/adapters/implementations/generic.adapter.ts` (new)
- ✅ `src/content-script/pricePicker.ts` (new)
- ✅ `src/content-script.ts` (modified)
- ✅ `src/service-worker.ts` (modified)
- ✅ `src/core/priceChecker.ts` (modified)
- ✅ `src/popup/popup.ts` (modified)
- ✅ `src/popup/styles.css` (modified)
- ✅ `tests/adapters/generic.test.ts` (new)
- ✅ `tests/utils/priceParser.test.ts` (new)

**Test Coverage**: 126 tests passing ✅
