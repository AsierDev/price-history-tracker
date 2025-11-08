# Developer Guide – Price History Tracker

Esta guía cubre arquitectura, desarrollo, testing y troubleshooting para contribuir a la extensión.

---

## 1. Arquitectura

### 1.1 Patrón Adapter

Cada plataforma (Amazon, eBay, AliExpress) tiene su propio adapter que implementa `PriceAdapter`:

```typescript
interface PriceAdapter {
  name: string;
  enabled: boolean;
  canHandle(url: string): boolean;
  extractData(html: string): Promise<ExtractedProductData>;
  generateAffiliateUrl(url: string): string;
}
```

- **Registry**: Auto‑descubre adapters disponibles (`adapters/registry.ts`)
- **Extensión**: Para añadir una nueva plataforma solo se necesita un nuevo archivo + import

### 1.2 Flujo de datos

1. **Content script** inyecta botón "Track Price" en páginas compatibles
2. **Service worker** orquesta alarmas y actualizaciones de precios
3. **Popup** muestra productos y permite acciones manuales
4. **Chrome Storage Sync** persiste datos entre dispositivos (límite ~100 KB)

### 1.3 Rate limiting

Backoff exponencial por dominio para evitar baneos:
- 1er fallo: 1 min
- 2º fallo: 5 min
- 3er fallo: 30 min
- 4º+ fallo: 2 h

### 1.4 Parser HTML

Los adapters usan `createDocument(html)` de `utils/htmlParser.ts`, que internamente utiliza **linkedom** para funcionar en el contexto del service worker. No usar `DOMParser` directamente.

---

## 2. Stack técnico

- **TypeScript** (strict mode)
- **esbuild** (build)
- **Chrome APIs** (Storage Sync, Alarms, Notifications)
- **linkedom** (parser HTML en service worker)
- **Chart.js** (gráficos en popup)

### 2.1 Gráfico de Historial (Chart.js)

Detalles clave de la implementación:

- **Botón `📊 Historial`** en cada tarjeta.
  - Visible solo si `priceHistory.length ≥ 2`.
- **Modal**: overlay centrado (máx. 600 px), animación *fade-in*.
- **Estadísticas**: precio actual, inicial, mínimo, máximo (colores verde/rojo).
- **Gráfico Line**: último 50 registros, relleno semitransparente, línea suavizada `tension: 0.4`.
- **Dark Mode**: colores y grid ajustados automáticamente.
- **Memoria**: `chart.destroy()` al cerrar; listeners de `ESC` eliminados.
- **Accesibilidad**: cierre con `ESC`, click overlay o botón X; `aria-labels`.

Para personalizar, revisa `popup/popup.ts` (`renderPriceChart`, `updateHistoryStats`) y `popup/styles.css`.

---

## 3. Desarrollo local

```bash
npm install          # Instalar dependencias
npm run watch        # Build continuo
npm run build        # Build de producción
npm run lint         # ESLint
```

### 3.1 Estructura de carpetas

```
src/
├── core/              # Lógica de negocio
│   ├── types.ts       # Interfaces
│   ├── storage.ts     # Chrome Storage wrapper
│   ├── priceChecker.ts # Orquestador de chequeos
│   ├── rateLimiter.ts # Backoff
│   └── notificationManager.ts
├── adapters/          # Implementaciones por plataforma
│   ├── types.ts
│   ├── registry.ts
│   └── implementations/
├── popup/             # UI del popup
├── utils/             # Utilidades
├── service-worker.ts  # Background orchestration
├── content-script.ts  # Inyección de botón
└── manifest.json      # Manifest V3
```

---

## 4. Agregar una nueva plataforma

1. **Crear adapter**: `src/adapters/implementations/tienda.adapter.ts`
2. **Implementar `PriceAdapter`**:
   - `canHandle(url)`: detecta URLs compatibles
   - `extractData(html)`: extrae título, precio, imagen, disponibilidad
   - `generateAffiliateUrl(url)`: añade IDs de afiliado
3. **Importar en registry**: añadir `import './implementations/tienda.adapter';` en `src/adapters/registry.ts`
4. **Probar**: build + cargar extensión + visitar URL de la tienda

> Ver `docs/README-ADAPTERS.md` para template y ejemplo completo.

---

## 5. Testing

### 5.1 Build verification

```bash
npm run build   # Debe completar sin warnings
```

### 5.2 Manual testing checklist

- Instalación: extensión carga en `chrome://extensions`
- Track product: botón aparece y agrega producto correctamente
- Popup UI: búsqueda, dark mode, botón refresh
- Service worker: alarmas creadas, logs visibles
- Notificaciones: se disparan al bajar precio ≥5 %
- Rate limiting: backoff aplicado en fallos
- Gráficos: modal de historial con Chart.js

### 5.3 Debug tools

```js
// Ver storage
chrome.storage.sync.get('priceTrackerData', console.log);

// Ver alarmas
chrome.alarms.getAll(console.log);

// Forzar chequeo manual
chrome.runtime.sendMessage({ action: 'checkPricesNow' }, console.log);

// Limpiar rate limits
chrome.runtime.sendMessage({ action: 'clearAllRateLimits' }, console.log);
```

---

## 6. Troubleshooting

| Síntoma | Causa común | Solución |
| --- | --- | --- |
| El botón "Track Price" no aparece | URL no coincide con patterns | Revisa `manifest.json` y el adapter |
| No se actualizan los precios | `DOMParser` no disponible en service worker | Usa `createDocument()` de `utils/htmlParser.ts` |
| Extension no se carga | Build falló o `dist/` corrupto | `rm -rf dist && npm run build` |
| Notificaciones no aparecen | Chrome bloquea o no hay bajada ≥5 % | Habilita notificaciones en Chrome y simula bajada |

---

## 7. Contribución

1. Fork del repositorio
2. Feature branch: `git checkout -b feature/nueva-plataforma`
3. Commits atómicos con mensajes claros
4. Pull request con checklist de testing completado

---

## 8. Release

- Actualizar `package.json` (versión)
- Build: `npm run build`
- Tag en Git: `git tag v1.0.0`
- Publicar en Chrome Web Store

---

¿Dudas? Revisa `docs/USER_GUIDE.md` para flujo de usuario o abre un issue.
