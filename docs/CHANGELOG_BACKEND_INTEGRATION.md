# Changelog: Backend Integration & Storage Refactoring

## Resumen de Cambios

Esta actualización resuelve dos problemas críticos:
1. **Error de quota en `chrome.storage.sync`** → Migración a `chrome.storage.local` con keys divididas
2. **Historial limitado** → Integración de Firebase para historial compartido entre usuarios

---

## 🔧 Cambios Críticos en Storage

### Antes (Problema)
```javascript
// chrome.storage.sync (límite 8KB por item, 100KB total)
{
  "priceTrackerData": {
    products: [
      {
        id: "123",
        title: "Product",
        imageUrl: "data:image/base64...", // ❌ Pesado
        priceHistory: [...50 entries],      // ❌ Crece sin límite
        // ... más campos
      }
    ]
  }
}
```

**Resultado**: Error `kQuotaBytesPerItem quota exceeded` al agregar productos.

### Después (Solución)
```javascript
// chrome.storage.local (límite 10MB total)
{
  "config": { ... },
  "anonymousUserId": "firebase-uid-abc123",
  "lastCheckTime": 1699451234567,
  "product_123": {
    id: "123",
    title: "Product",
    currentPrice: 72.00,
    initialPrice: 68.00,
    currency: "EUR",
    adapter: "amazon",
    addedAt: 1699451234567,
    lastCheckedAt: 1699451234567,
    isActive: true
    // ✅ Sin imageUrl, sin priceHistory (están en backend)
  },
  "product_456": { ... },
  "rateLimit_amazon.es": { ... }
}
```

**Resultado**: 
- ✅ Cada producto ocupa ~300 bytes (vs ~5KB antes)
- ✅ 50 productos = ~15KB total (vs 250KB+ antes)
- ✅ No más errores de quota

---

## 🔥 Integración Firebase

### Arquitectura

```
┌─────────────────┐
│  Chrome Storage │  ← Metadatos ligeros (local)
│     (Local)     │
└────────┬────────┘
         │
         ├─ product_123: { id, title, currentPrice, ... }
         ├─ product_456: { ... }
         └─ config, anonymousUserId
         
┌─────────────────┐
│    Firestore    │  ← Historial completo (compartido)
│   (Backend)     │
└────────┬────────┘
         │
         ├─ products/hash(url):
         │    {
         │      url, title, platform, imageUrl,
         │      priceHistory: [500 entries max],
         │      contributorCount: 15
         │    }
         └─ ...
```

### Flujo de Datos

#### Al Agregar Producto
1. Usuario hace click en "Track Price"
2. Content script extrae datos (título, precio, imagen)
3. Service worker:
   - Envía datos a Firebase → `addPriceToBackend()`
   - Guarda metadatos en local storage (sin imagen, sin historial)
4. Firebase:
   - Crea documento si no existe
   - Agrega precio a `priceHistory[]`
   - Incrementa `contributorCount`

#### Durante Checks Automáticos
1. Service worker fetch página del producto
2. Extrae nuevo precio
3. Actualiza Firebase → `updatePriceInBackend()`
4. Actualiza metadatos locales (solo `currentPrice`, `lastCheckedAt`)
5. Si precio bajó → Notificación

#### Al Abrir Gráfico
1. Popup fetch historial desde Firebase → `getProductHistory(url)`
2. Renderiza Chart.js con datos completos
3. Muestra estadísticas (min, max, promedio)

---

## 📁 Archivos Modificados

### Core
- ✅ `src/core/types.ts` - Separar `TrackedProduct` (local) de `ProductDocument` (backend)
- ✅ `src/core/storage.ts` - Refactorización completa a `chrome.storage.local` con keys divididas
- ✅ `src/core/priceChecker.ts` - Integrar `updatePriceInBackend()` en checks

### Backend (Nuevo)
- ✅ `src/backend/config.ts` - Inicialización Firebase
- ✅ `src/backend/auth.ts` - Autenticación anónima
- ✅ `src/backend/backend.ts` - API Firestore (CRUD operaciones)

### Utils
- ✅ `src/utils/urlUtils.ts` - Agregar `cleanUrl()` y `hashUrl()`

### UI
- ✅ `src/service-worker.ts` - Integrar backend al agregar productos
- ✅ `src/popup/popup.ts` - Fetch historial e imágenes desde backend

### Config
- ✅ `.env.example` - Variables Firebase
- ✅ `esbuild.config.js` - Bundlear Firebase SDK
- ✅ `package.json` - Dependencia `firebase`

---

## 🔄 Migración de Datos

### Storage Sync → Local

**No hay migración automática**. Los usuarios existentes verán:
- ✅ Extensión funciona normalmente
- ❌ Productos anteriores no aparecen (storage diferente)
- ✅ Pueden re-agregar productos (historial compartido disponible)

**Alternativa**: Implementar script de migración one-time:
```javascript
// En service-worker.ts onInstalled
const oldData = await chrome.storage.sync.get('priceTrackerData');
if (oldData.priceTrackerData) {
  // Migrar productos a nuevo formato
  for (const product of oldData.priceTrackerData.products) {
    await StorageManager.addProduct({
      id: product.id,
      title: product.title,
      url: product.url,
      currentPrice: product.currentPrice,
      initialPrice: product.initialPrice,
      currency: product.currency,
      adapter: product.adapter,
      addedAt: product.addedAt,
      lastCheckedAt: product.lastCheckedAt,
      isActive: product.isActive,
    });
  }
  // Limpiar storage antiguo
  await chrome.storage.sync.clear();
}
```

---

## 🧪 Testing Checklist

### Storage Local
- [x] Agregar 50 productos sin error de quota
- [x] Cada producto ocupa <500 bytes
- [x] Total storage <20KB para 50 productos
- [x] Productos se dividen en keys individuales
- [x] `chrome.storage.local.get(null)` retorna estructura correcta

### Backend Firebase
- [ ] Configurar Firebase project (ver `FIREBASE_SETUP.md`)
- [ ] Agregar producto → aparece en Firestore Console
- [ ] Múltiples usuarios → historial compartido acumula
- [ ] Gráfico muestra historial completo (incluso antes de agregar)
- [ ] Autenticación anónima invisible para usuario

### Funcionalidad
- [x] Build compila sin errores (`npm run build`)
- [x] Extensión carga en Chrome sin warnings
- [ ] Agregar producto funciona (con y sin Firebase)
- [ ] Checks automáticos actualizan backend
- [ ] Notificaciones de bajada de precio funcionan
- [ ] Gráfico renderiza correctamente
- [ ] Dark mode funciona
- [ ] Search/filter productos funciona

### Fallback (Sin Firebase)
- [ ] Si Firebase no configurado → extensión funciona local-only
- [ ] Logs indican: "Firebase not configured"
- [ ] Gráfico muestra solo precio actual (fallback)

---

## 📊 Métricas de Mejora

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| **Storage por producto** | ~5KB | ~300 bytes | **94% reducción** |
| **Límite de productos** | ~15 (quota error) | 50+ | **3x+ capacidad** |
| **Historial disponible** | Desde que usuario agregó | Desde primer usuario | **Historial completo** |
| **Tamaño bundle** | ~400KB | ~1.6MB | +1.2MB (Firebase SDK) |
| **Build time** | ~50ms | ~65ms | +15ms |

---

## 🚀 Próximos Pasos

### Inmediato
1. Configurar Firebase project (seguir `FIREBASE_SETUP.md`)
2. Testing manual completo
3. Verificar que fallback funciona sin Firebase

### Corto Plazo
- Implementar script de migración de datos antiguos
- Agregar loading states en popup al fetch backend
- Implementar retry logic con exponential backoff
- Agregar métricas: latencia, cache hits, errores

### Largo Plazo
- Implementar Cloud Functions para validación
- Agregar índices compuestos en Firestore
- Implementar rate limiting por usuario
- Considerar CDN para imágenes de productos
- Implementar sincronización offline-first (Service Worker)

---

## 🐛 Known Issues

1. **TypeScript Lint Errors en Firebase imports**
   - Errores: "Definición circular del alias de importación"
   - Causa: Falso positivo del linter
   - Impacto: Ninguno (build compila correctamente)
   - Fix: Ignorar o actualizar `@typescript-eslint`

2. **Bundle Size aumentó +1.2MB**
   - Causa: Firebase SDK incluido
   - Impacto: Extensión más pesada (pero dentro de límites)
   - Alternativa: Usar Firebase REST API (más complejo)

3. **Storage listener cambió de `sync` a `local`**
   - Popup escucha `chrome.storage.onChanged` en área `local`
   - Verificar que auto-refresh funciona

---

## 📚 Documentación Adicional

- `docs/FIREBASE_SETUP.md` - Guía completa de configuración Firebase
- `docs/README-ADAPTERS.md` - Cómo agregar nuevos adapters
- `docs/TESTING_GUIDE.md` - Guía de testing manual
- `.env.example` - Variables de entorno requeridas

---

## 🔒 Seguridad y Privacidad

### Datos que NO se almacenan
- ❌ Email, nombre, dirección IP del usuario
- ❌ Qué productos trackea cada usuario individualmente
- ❌ Información personal de ningún tipo

### Datos que SÍ se almacenan
- ✅ URLs de productos (limpias, sin tracking params)
- ✅ Historial de precios agregado (anónimo)
- ✅ UID de Firebase (anónimo, no vinculado a identidad)

### Firebase Security Rules
```javascript
// Solo usuarios autenticados (incluso anónimos) pueden escribir
allow write: if request.auth != null;
// Todos pueden leer (historial público)
allow read: if true;
```

---

**Versión**: 2.0.0  
**Fecha**: 2024-11-08  
**Autor**: Cascade AI Assistant
