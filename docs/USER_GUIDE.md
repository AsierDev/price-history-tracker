# User Guide – Price History Tracker

This guide explains how to install the extension, track products, and interpret the popup UI.

---

## 1. Requirements

- Google Chrome/Chromium 113+ (MV3 support required)
- macOS / Windows / Linux
- Extension build produced from this repository (`npm run build`)

---

## 2. Installation

1. Run `npm install && npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **“Load unpacked”** and select the `dist/` folder.
5. Pin the 💰 icon if you want quick access to the popup.

After rebuilding, click the reload ↻ icon in `chrome://extensions` to refresh the loaded extension.

---

## 3. Tracking products

### 3.1 Supported sites (Tier 1/2)

1. Browse to a product on Amazon, eBay, AliExpress, PC Componentes, MediaMarkt, El Corte Inglés (or any whitelist site).
2. Wait for the floating “💰 Track Price” button.
3. Click it; once the toast reads “Product added ✅”, open the popup to confirm the card appears.

### 3.2 Manual mode (Tier 3)

For unsupported stores (Etsy, Shopify, etc.):

1. The floating button shows a 📍 icon meaning manual mode.
2. Click it to enable the price picker (overlay + crosshair cursor).
3. Hover over the price, ensure the tooltip says “Looks like a price”, then click.
4. The extension stores the selector and resumes automatic tracking using the Generic Adapter.

If the store changes layout later, open the popup and delete/re-track the product to select a new price element.

---

## 4. Popup overview

- **Stats bar** – total tracked products + cumulative savings (positive differences only).
- **Search** – filters cards instantly.
- **Dark mode toggle** – persists via `localStorage`.
- **Per-product card**
  - Current vs. initial price (+/- badge when different)
  - Store badge (`amazon`, `manual`, etc.)
  - `📊 Historial` – appears once the product has ≥2 checks and opens the Chart.js modal.
  - `View` – opens the product (affiliate URL if configured).
  - `Remove` – stops tracking after confirmation.
- **Refresh button (🔄)** – triggers an immediate check via the service worker.

---

## 5. Notifications

When a check detects a drop ≥ the configured threshold (default 5 %), Chrome displays a notification with action buttons:

- **View product** – opens the URL in a new tab.
- **Stop tracking** – removes the product immediately.

Ensure Chrome notifications are allowed for the browser profile; otherwise the alert is suppressed.

---

## 6. Settings

Click the gear icon ⚙️ in the popup to adjust:

- Notification threshold (slider 1–50 %)
- Check interval (1h, 3h, 6h default, 12h, 24h)
- Enable/disable notifications
- Test notification + test Firebase connection (when configured)
- Clear rate limits (for debugging)

Changes are saved to `chrome.storage.local` and take effect immediately; updating the interval triggers the service worker to reschedule alarms.

---

## 7. Optional: Affiliate IDs & Firebase

- Duplicate `.env.example` → `.env` and fill any affiliate tags you have. Rebuild and reload so adapters append the correct IDs.
- Follow [`docs/FIREBASE_SETUP.md`](FIREBASE_SETUP.md) if you want shared price history across users/devices. Without Firebase the extension still works in local-only mode (charts show personal history only).

---

## 8. Troubleshooting

| Issue | Fix |
| --- | --- |
| Button never appears | Confirm the URL matches a supported domain or switch to manual picker mode. Reload the page after loading/reloading the extension. |
| Product isn’t added | Check the popup console for errors (DevTools → chrome-extension://…/popup.html) and the service worker console. |
| Manual picker won’t accept selection | Ensure the tooltip says the text looks like a price; try selecting a different element or disable ad blockers interfering with overlays. |
| Notifications missing | Verify Chrome’s notification permission and that the price drop exceeded the threshold. |
| Firebase errors | Double-check `.env` values, rebuild, and confirm anonymous auth is enabled. |

If you need more diagnostics:

```js
// Inspect storage
chrome.storage.local.get(null, console.log);

// Inspect alarms
chrome.alarms.getAll(console.log);
```

---

Need advanced developer information? Continue with [`docs/DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md) or the adapter-specific documentation.
