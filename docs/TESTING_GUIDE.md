# Testing Guide – Price History Tracker

Use this checklist before every release to ensure the extension behaves correctly.

---

## 1. Pre-flight

```bash
npm run build   # must finish without warnings
```

Load the freshly built `dist/` folder at `chrome://extensions` (Developer Mode → Load unpacked). Confirm the 💰 icon appears in the toolbar and the popup opens.

---

## 2. Installation sanity

- [ ] Extension enabled in `chrome://extensions` and service worker running.
- [ ] Toolbar icon visible; popup renders the empty state (“No products tracked yet”).

---

## 3. Specific adapters

Perform the following on desktop Chrome (regular and incognito if possible):

### Amazon
1. Open `https://www.amazon.com/dp/B08N5WRWNW` (or any ASIN).
2. Wait for the floating “💰 Track Price” button.
3. Click it; message should go `Adding...` → `Tracked!`.
4. Open the popup; verify the product card shows Amazon badge, price, currency, image.

### eBay
Repeat with any `https://www.ebay.com/itm/<id>` URL; ensure the badge reads `ebay`.

### AliExpress
Repeat with any `https://www.aliexpress.com/item/<id>.html`; expect `aliexpress` badge.

### Manual fallback (Generic)
1. Visit an unsupported site (e.g., Etsy product).
2. Ensure the button text indicates manual tracking (picker icon 📍).
3. Activate the picker, select the price, and confirm validation.
4. In the popup the product should show `Manual` badge + the store name detected by metadata extractor.

---

## 4. Popup UI

- **Stats** – “Products” count increments; “Total Savings” reflects positive deltas only.
- **Search** – type a fragment; product list filters immediately.
- **Dark mode** – toggle 🌙/☀️, close & reopen popup to verify persistence.
- **Per-card actions** –
  - `📊 Historial` appears once a product has ≥2 checks and opens the Chart.js modal.
  - `View` opens a new tab (with affiliate URL if defined).
  - `Remove` asks for confirmation and deletes the product.
- **Refresh button (🔄)** – disables while running, re-enables after PriceChecker finishes.

---

## 5. Service worker

1. Open `chrome://extensions`, click “Service worker” under the extension → Console.
2. Trigger a manual refresh (🔄) and expect logs:
   - `Starting price check for all products`
   - `Checking {n} active products`
   - `Product checked successfully`
   - `Price check completed`
3. Inspect alarms:
   ```js
   chrome.alarms.getAll(console.log);
   ```
   Should list an alarm with `periodInMinutes: 360`.
4. Inspect storage:
   ```js
   chrome.storage.local.get(null, console.log);
   ```
   Verify product keys (`product_<id>`), rate limits, config, last check time.

---

## 6. Rate limiting

1. Temporarily edit a product URL to something invalid (DevTools → Application → Storage → chrome.storage.local).
2. Trigger a check; log should report a failure and `backoffMinutes: 1`.
3. Trigger another check immediately → product should be skipped.
4. Wait one minute, trigger again → the check should proceed.

---

## 7. Notifications

1. Add a product.
2. Reduce its `currentPrice` in storage to simulate a >5 % drop.
3. Trigger a manual check.
4. Expect a Chrome notification with drop percentage and two buttons:
   - **View product** – opens the URL.
   - **Stop tracking** – removes the product.

---

## 8. Edge cases

- [ ] Attempt to add the same URL twice; expect an error toast.
- [ ] Add more than 50 products; expect a “Maximum products tracked” message.
- [ ] Try tracking a page without a price; ensure a friendly error is shown.
- [ ] Cancel the manual picker with ESC; ensure the state resets.

---

## 9. Performance spot checks

- Popup opens in under 200 ms (no spinner once cached).
- Price chart renders smoothly (<500 ms) and destroys the Chart.js instance on close.
- Manual check does not freeze the popup UI.
- Service worker responds to messages instantly (no unhandled promise rejections).

---

## 10. Test report template

```
## Test Report – YYYY-MM-DD

Chrome Version: XX
Extension Version: X.Y.Z
OS: macOS / Windows / Linux

Automated tests: npm test (pass/fail)
Manual checklist:  ✅ / ⚠️
Issues found: (link to GitHub issues)
Notes: …
```

Archive reports in the repo or issue tracker if your workflow requires audit trails.
