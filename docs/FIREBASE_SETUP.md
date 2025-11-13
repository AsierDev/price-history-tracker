# Firebase Setup Guide

Use this document to enable the shared price-history backend. Firebase integration is optional; the extension continues to work in local-only mode when omitted.

---

## 1. Create a Firebase project

1. Visit [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and follow the wizard (Analytics optional).
3. Once created, open the project dashboard.

## 2. Enable Firestore

1. Sidebar → **Build → Firestore Database** → **Create database**.
2. Start in **test mode** for development (switch to production rules later).
3. Choose a region close to your users.

### Recommended security rules (dev)

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Publish the rules once pasted.

## 3. Enable anonymous authentication

1. Sidebar → **Build → Authentication** → **Get started**.
2. In **Sign-in method**, enable **Anonymous** and save.

## 4. Register a web app & copy config

1. Project settings (gear icon) → **General** tab.
2. Under “Your apps” click the `</>` icon to register a web app.
3. Name it (e.g., `price-tracker-extension`) and skip Hosting.
4. Copy the generated config:

```js
const firebaseConfig = {
  apiKey: 'AIzaSy...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123'
};
```

## 5. Populate `.env`

Duplicate `.env.example` → `.env` and fill the Firebase variables:

```
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
```

Rebuild (`npm run build`) so esbuild injects the values.

## 6. Verify integration

1. Load the rebuilt extension.
2. Add a product; check Firestore → `products` collection. Documents should contain `url`, `title`, `priceHistory`, etc.
3. Click the popup’s **Test Firebase** button to ensure anonymous auth succeeded.
4. Watch the Chart.js modal – it should reflect shared history across users when multiple contributors track the same URL.

### Firestore document shape

```js
{
  url: 'https://www.amazon.es/dp/B06XGW29XJ',
  title: 'Helly Hansen Dubliner',
  platform: 'amazon',
  imageUrl: 'https://m.media-amazon.com/...',
  priceHistory: [
    { price: 68.0, currency: 'EUR', timestamp: 1699000000000, source: 'user' },
    { price: 65.5, currency: 'EUR', timestamp: 1699050000000, source: 'check' }
  ],
  lastUpdated: 1699050000000,
  contributorCount: 15
}
```

---

## 7. Production hardening

Once you move beyond MVP:

- Tighten security rules (limit updates, cap priceHistory length, forbid deletes).
- Enable Firestore usage alerts (Billing → Budget & alerts).
- Consider Cloud Functions to validate writes or enforce per-user quotas.
- Switch Firestore to production mode and stage rule changes via CI.

Example production rule snippet:

```js
match /products/{productId} {
  allow read: if true;
  allow create: if request.auth != null;
  allow update: if request.auth != null &&
    request.resource.data.priceHistory.size() <= 500;
  allow delete: if false;
}
```

---

## 8. Troubleshooting

| Issue | Fix |
| --- | --- |
| “Firebase not configured” logs | `.env` missing values or build not rerun. Rebuild after editing env vars. |
| “Permission denied” from Firestore | Anonymous auth disabled or rules too strict. Enable Anonymous sign-in and republish rules. |
| Notifications mention backend failure | Firestore write rejected; inspect service worker console for details. |
| Bundle still shows placeholder keys | Ensure `.env` values exist before running `npm run build`; audit `dist/*.js` with `rg -n "FIREBASE"`. |

If Firebase is unavailable the extension continues in local-only mode (products remain in `chrome.storage.local`; backend sync is skipped and logs will state “Firebase not configured, skipping backend sync”).
