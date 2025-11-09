# 💰 Price History Tracker

Chrome extension para rastrear historial de precios en Amazon, eBay y AliExpress.

## 🚀 Quick Start

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

- ✅ **Soporte Multi-Plataforma**: Amazon, eBay, AliExpress
- ✅ **Chequeo Automático**: Cada 6 horas
- ✅ **Notificaciones**: Alertas cuando el precio baja >5%
- ✅ **Gráficos de Historial**: Visualización temporal de precios con Chart.js
- ✅ **Rate Limiting**: Backoff exponencial para evitar baneos
- ✅ **Dark Mode**: Tema claro/oscuro (gráficos adaptativos)
- ✅ **URLs de Afiliado**: Estructura lista para monetización
- ✅ **Backend Firebase**: Historial compartido entre usuarios (anónimo)
- ✅ **Storage Optimizado**: chrome.storage.local con keys divididas (sin límites de quota)

## 📖 Documentación

- [**Setup & Testing Guide**](docs/README.md) - Instalación, uso y testing
- [**Adapter Development Guide**](docs/README-ADAPTERS.md) - Cómo agregar nuevas plataformas
- [**Firebase Setup Guide**](docs/FIREBASE_SETUP.md) - Configuración del backend Firebase
- [**Backend Integration Changelog**](docs/CHANGELOG_BACKEND_INTEGRATION.md) - Detalles técnicos de la integración

## 🏗️ Arquitectura

### Patrón Adapter

Cada plataforma tiene su propio adapter que implementa `PriceAdapter`:

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

Ver [Testing Checklist](docs/README.md#testing-checklist) para guía completa.

### Quick Test

```bash
# 1. Build
npm run build

# 2. Cargar en Chrome
# chrome://extensions → Load unpacked → dist/

# 3. Visitar producto Amazon
# https://amazon.com/dp/...

# 4. Click "Track Price"

# 5. Verificar en popup
# Click icono extensión
```

## 🔧 Desarrollo

### Watch Mode

```bash
npm run watch
```

### Linting

```bash
npm run lint
```

## 📝 Variables de Entorno

Copiar `.env.example` a `.env`:

```env
# Affiliate IDs
AFFILIATE_AMAZON_TAG=tu-tag-amazon
AFFILIATE_ADMITAD_ID=tu-id-admitad
AFFILIATE_EBAY_ID=tu-id-ebay

# Firebase (opcional - ver docs/FIREBASE_SETUP.md)
FIREBASE_API_KEY=your_api_key
FIREBASE_PROJECT_ID=your_project_id
# ... más variables Firebase
```

**Nota**: La extensión funciona sin Firebase (modo local-only), pero el historial compartido requiere configuración Firebase.

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
