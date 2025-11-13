# 💰 Price History Tracker

Chrome extension para rastrear historial de precios en **cualquier sitio e-commerce**. Incluye soporte específico para Amazon, eBay y AliExpress, más un **Generic Adapter** que permite trackear precios en cualquier otra tienda mediante selección manual.

[![CI](https://github.com/your-username/price-history-tracker/workflows/CI/badge.svg)](https://github.com/your-username/price-history-tracker/actions)
[![Coverage](https://codecov.io/gh/your-username/price-history-tracker/branch/main/graph/badge.svg)](https://codecov.io/gh/your-username/price-history-tracker)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Quick Start

> **Requisitos:** Node.js 20.x y npm 9+

```bash
# Instalar dependencias
npm install

# Compilar extensión
npm run build

# Cargar en Chrome
# 1. Abrir chrome://extensions
# 2. Activar "Modo desarrollador"
# 3. Click "Cargar extensión sin empaquetar"
# 4. Seleccionar carpeta dist/
```

## ✨ Características

### 🎯 Core Features
- ✅ **Soporte Multi-Plataforma**: Amazon, eBay, AliExpress y 🇪🇸 **PcComponentes + MediaMarkt**
- ✅ **Enhanced Generic Adapter (Whitelist)**: auto-extracción en +600 tiendas validadas (Fnac, Decathlon, Carrefour…)
- ✅ **Generic Adapter (Manual)**: Trackea cualquier sitio mediante selección de precio
- ✅ **Chequeo Automático**: Cada 6 horas
- ✅ **Notificaciones**: Alertas cuando el precio baja >5%
- ✅ **Gráficos de Historial**: Visualización temporal de precios con Chart.js
- ✅ **Dark Mode**: Tema claro/oscuro (gráficos adaptativos)

### 🔧 Technical Features
- ✅ **Service Worker ESM** + Content Script con gating SPA-aware (`resolveSupportMode`)
- ✅ **Extractor de metadatos (DOM real)**: JSON-LD → OG/Twitter → H1/title → fallback limpio
- ✅ **Detector e-commerce**: señales combinadas + blacklist para no inyectar en Google/YouTube/etc.
- ✅ **Price Picker Visual**: Estados `idle → extracting → added/error` y badge por tier
- ✅ **Rate Limiting**: Backoff exponencial por dominio (1m → 5m → 30m → 2h)
- ✅ **Storage híbrido**: chrome.storage.local minimalista + hooks para backend Firebase
- ✅ **Afiliados seguros**: placeholders via `.env` + `esbuild.define`, sin secretos en runtime

## 📖 Documentación

- [**Setup & Testing Guide**](docs/README.md) - Instalación, uso y testing
- [**Generic Adapter Guide**](docs/GENERIC_ADAPTER_GUIDE.md) - **NUEVO**: Cómo usar el tracker universal
- [**Adapter Development Guide**](docs/README-ADAPTERS.md) - Cómo agregar nuevas plataformas
- [**Firebase Setup Guide**](docs/FIREBASE_SETUP.md) - Configuración del backend Firebase
- [**Backend Integration Changelog**](docs/CHANGELOG_BACKEND_INTEGRATION.md) - Detalles técnicos de la integración
- [**Bug Fixes**](docs/BUG_FIX_MANIFEST_PERMISSIONS.md) - Fixes aplicados para Generic Adapter

## 🏗️ Arquitectura

### Patrón Adapter + sistema de tiers

1. **Tier 1 (Specific)** – adapters dedicados para Amazon, eBay, AliExpress, PcComponentes y MediaMarkt.
2. **Tier 2 (Whitelist)** – `EnhancedGenericAdapter` aplica cascada `JSON-LD → OG/Twitter → Shopify/Presta/Woo/Magento → patrones genéricos`.
3. **Tier 3 (Manual)** – `GenericAdapter` + Price Picker universal como red de seguridad.

Cada adapter implementa `PriceAdapter`:

```typescript
interface PriceAdapter {
  name: string;
  enabled: boolean;
  canHandle(url: string): boolean;
  extractData(html: string): Promise<ExtractedProductData>;
  generateAffiliateUrl(url: string): string;
}
```

### Rate Limiting

Backoff exponencial por dominio:

- 1er fallo: 1 minuto
- 2do fallo: 5 minutos
- 3er fallo: 30 minutos
- 4to+ fallo: 2 horas

### Ejecución Serial (MVP)

Los chequeos se ejecutan serialmente (1 producto/segundo). Hooks preparados para paralelización futura.

## 🛠️ Stack Técnico

- **TypeScript** (strict mode)
- **esbuild** (bundling)
- **Chrome APIs** (Storage Local, Alarms, Notifications)
- **Firebase** (Firestore + Anonymous Auth)
- **linkedom** (parser HTML en service worker)
- **Chart.js** (visualización del historial de precios)

## 📁 Estructura del Proyecto

```
src/
├── core/              # Lógica de negocio
├── adapters/          # Patrón adapter para plataformas
├── backend/           # Firebase integration (Firestore + Auth)
├── popup/             # UI del popup
├── utils/             # Utilidades
├── service-worker.ts  # Orquestación background
├── content-script.ts  # Inyección de botón
└── manifest.json      # Manifest V3
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests once (CI mode)
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

**Current coverage: 60%+ (core logic)** ✅  
**Target achieved**: >60% coverage enforced in CI

**Test Suites:**

- ✅ **Unit Tests**: Adapters (Amazon, eBay, AliExpress)
- ✅ **Unit Tests**: Core logic (Storage, PriceChecker, RateLimiter)
- ✅ **Integration Tests**: End-to-end product flows
- ✅ **CI Pipeline**: Automated testing on every push/PR

### Test Infrastructure

- **Framework**: Vitest with jsdom environment
- **Coverage**: Istanbul/v8 with 60% threshold enforcement
- **Chrome Mocks**: Complete Chrome API mocking for extension testing
- **CI/CD**: GitHub Actions with coverage reporting to Codecov

### Coverage Breakdown

```
✅ Adapters: Amazon, eBay, AliExpress (100%+)
✅ Core: Storage, PriceChecker, RateLimiter (80%+)
✅ Integration: Product addition & checking flows (70%+)
✅ Utilities: Price parsing, URL utils (90%+)
```

### Quality Assurance

**Code Audit Results:** ✅ **PASSED**

- **Linting:** 0 errors, 0 warnings
- **Type Checking:** Strict TypeScript compilation
- **Security:** No vulnerabilities detected
- **Performance:** Bundle sizes optimized
- **Memory:** No leaks detected
- **Coverage:** >60% maintained in CI

See [Complete Audit Report](docs/AUDIT_REPORT.md) for detailed findings.

## 🔧 Desarrollo

### Watch Mode

```bash
npm run watch
```

### Linting

```bash
npm run lint
```

### CI Checks (Pre-commit)

Run all pipeline checks locally before pushing:

```bash
npm run ci
```

This executes the same checks as GitHub Actions:

- Linting (source + tests)
- TypeScript type checking
- Unit tests execution
- Build verification

## 📝 Variables de Entorno

1. Copia `.env.example` a `.env`.
2. Rellena únicamente los IDs reales que vayas a usar (el resto pueden quedarse vacíos).
3. Esbuild inyecta los valores mediante `define`, así que nada de `process.env` llega al runtime del worker.

```env
# Affiliate IDs
AFFILIATE_AMAZON_TAG=tu-tag-amazon
AFFILIATE_EBAY_ID=
AFFILIATE_ADMITAD_ID=

# Firebase (opcional - ver docs/FIREBASE_SETUP.md)
FIREBASE_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
```

> ℹ️ Puedes dejar Firebase vacío y la extensión funcionará en modo local-only. Los hooks del backend sólo se activan cuando la configuración está completa.

## 🎯 Roadmap

- [ ] Paralelización de chequeos con control de concurrencia
- [x] Backend sync para historial compartido ✅
- [x] Gráficos de historial de precios ✅
- [x] Storage optimizado (chrome.storage.local) ✅
- [ ] Umbrales de notificación personalizados por producto
- [ ] Export/import de productos trackeados
- [ ] Badge con contador de ahorros
- [ ] Cloud Functions para validación y rate limiting
- [ ] Sincronización offline-first

## 📄 Licencia

MIT

## 🤝 Contribuir

Ver [Adapter Development Guide](docs/README-ADAPTERS.md) para agregar nuevas plataformas.

## 📧 Soporte

Para issues o preguntas, abrir un issue en GitHub.
