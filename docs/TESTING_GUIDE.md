# Testing Guide – Price History Tracker

Esta guía contiene los pasos manuales para verificar que la extensión funciona correctamente antes de un release.

---

## 1. Prerrequisitos

```bash
npm run build   # Build exitoso sin warnings
```

Cargar la extensión en Chrome:
1. `chrome://extensions` → Modo desarrollador → Cargar extensión sin empaquetar → `dist/`
2. Verificar que el icono 💰 aparece en la barra de herramientas

---

## 2. Instalación

- [ ] Extensión visible en `chrome://extensions`
- [ ] Icono 💰 en toolbar
- [ ] Popup se abre al hacer clic
- [ ] Popup muestra "No products tracked yet"

---

## 3. Track Product (Amazon)

1. Navegar a `https://amazon.com/dp/B08N5WRWNW` (o cualquier producto)
2. Esperar 2 s
3. Verificar botón flotante **"💰 Track Price"** (abajo derecha)
4. Click → mensaje "⏳ Adding..." → "✅ Tracked!"
5. Abrir popup → producto debe aparecer con título, precio, imagen y etiqueta **amazon**

---

## 4. Track Product (eBay)

1. Navegar a `https://ebay.com/itm/` + cualquier ID
2. Repetir pasos del test anterior
3. Verificar etiqueta **ebay**

---

## 5. Track Product (AliExpress)

1. Navegar a `https://aliexpress.com/item/` + cualquier ID
2. Repetir pasos del test anterior
3. Verificar etiqueta **aliexpress**

---

## 6. Popup UI

### 6.1 Estadísticas
- [ ] "Products" muestra el número correcto
- [ ] "Total Savings" muestra 0€ (sin cambios)

### 6.2 Búsqueda
1. Agregar 3+ productos
2. Escribir en la caja de búsqueda
3. Verificar filtrado en vivo

### 6.3 Dark mode
1. Click 🌙 → tema oscuro
2. Click ☀️ → tema claro
3. Cerrar y reabrir popup → tema persiste

### 6.4 Botones de producto
- [ ] "View" abre el producto en nueva pestaña
- [ ] "Remove" muestra diálogo y elimina producto
- [ ] "🔄 Refresh" inicia chequeo manual

### 6.5 Gráfico de historial
1. Esperar a que un producto tenga ≥2 chequeos (automático o manual)
2. Verificar botón **"📊 Historial"** aparece
3. Click → modal con gráfico y estadísticas
4. Verificar que el gráfico muestra puntos de precio y tooltips
5. Cerrar modal → gráfico se destruye

---

## 7. Service Worker

### 7.1 Alarmas
En DevTools Console:
```js
chrome.alarms.getAll(console.log);
```
- [ ] Debe aparecer alarma `checkPrices` con `periodInMinutes: 360`

### 7.2 Chequeo manual
1. Agregar al menos 1 producto
2. Click 🔄 en popup
3. Abrir Service Worker DevTools (`chrome://extensions` → "Service worker")
4. Verificar logs:
   ```
   [INFO] Starting price check for all products
   [INFO] Checking X active products
   [DEBUG] Checking product {title}
   [DEBUG] Product checked successfully
   [INFO] Price check completed
   ```

### 7.3 Storage
```js
chrome.storage.sync.get('priceTrackerData', console.log);
```
- [ ] Estructura correcta: `{ products, rateLimitBuckets, config, lastCheckTime }`
- [ ] Cada producto contiene `priceHistory` con entradas

---

## 8. Rate Limiting (simulación)

1. Agregar producto con URL inválida (simula fallo)
2. Disparar chequeo manual
3. Verificar log: "Rate limit applied to domain X with backoffMinutes: 1"
4. Intentar nuevo chequeo inmediato → producto debe ser skipped
5. Esperar 1 min → reintentar → debe intentarse de nuevo

---

## 9. Notificaciones (simulación)

1. Agregar un producto
2. Modificar su precio en Storage (simula bajada >5 %):
   ```js
   chrome.storage.sync.get('priceTrackerData', data => {
     const p = data.priceTrackerData.products[0];
     p.currentPrice = p.initialPrice * 0.8; // -20%
     chrome.storage.sync.set({ priceTrackerData: data.priceTrackerData });
   });
   ```
3. Disparar chequeo manual con 🔄
4. Verificar que aparece notificación con:
   - Título: "💰 ¡Bajada de Precio!"
   - Mensaje: "Producto\n29.99€ → 23.99€ (-20.0%)"
   - Botones: "Ver Producto", "Dejar de Trackear"
5. Click "Ver Producto" → abre URL
6. Click "Dejar de Trackear" → elimina producto

---

## 10. Edge Cases

- [ ] No se pueden agregar >50 productos (alerta)
- [ ] No se pueden agregar duplicados (alerta)
- [ ] URLs inválidas manejan error sin crash
- [ ] Páginas sin precio manejan error

---

## 11. Performance

- [ ] Popup abre instantáneamente (<200 ms)
- [ ] Gráfico renderiza sin lag (<500 ms)
- [ ] Chequeo manual no bloquea UI
- [ ] Service worker responde a mensajes sin delay

---

## 12. Checklist final

- [ ] Build sin warnings
- [ ] Instalación correcta
- [ ] Track product en las 3 plataformas
- [ ] Popup UI funcional (búsqueda, dark mode, botones)
- [ ] Gráfico de historial visible y responsive
- [ ] Service worker logs OK
- [ ] Alarmas configuradas
- [ ] Storage persiste datos
- [ ] Rate limiting funciona
- [ ] Notificaciones aparecen y botones funcionan
- [ ] Edge cases manejados
- [ ] Performance aceptable

---

## 13. Reporte de testing

```markdown
## Test Report – YYYY-MM-DD

- Chrome Version: vX.Y.Z
- Extension Version: 1.0.0
- OS: macOS/Windows/Linux

Tests Passed: 12/12
Tests Failed: 0/12

Issues: None

Notes:
- Ready for release
```

---

¿Fallas? Documenta en un issue con pasos para reproducir, expected vs actual y screenshots si aplica.
