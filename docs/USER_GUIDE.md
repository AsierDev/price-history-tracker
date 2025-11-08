# User Guide – Price History Tracker

Esta guía cubre el flujo completo para instalar, configurar y utilizar la extensión.

---

## 1. Requisitos

- Google Chrome/Chromium (v113 o superior)
- Node.js 18+
- npm 9+

---

## 2. Instalación rápida

```bash
npm install
npm run build
```

Carga la extensión compilada:

1. Abre `chrome://extensions`
2. Activa **Modo desarrollador** (arriba a la derecha)
3. Pulsa **"Cargar extensión sin empaquetar"**
4. Selecciona la carpeta `dist/`

> Tip: cada vez que ejecutes `npm run build`, recarga la extensión desde `chrome://extensions` con el botón 🔄.

---

## 3. Primeros pasos

### 3.1 Trackear un producto

1. Visita un producto compatible en Amazon, eBay o AliExpress
2. Haz clic en el botón flotante **"💰 Track Price"**
3. Abre el popup de la extensión en la barra de Chrome
4. Verifica que el producto aparece con título, precio e imagen

### 3.2 Gestionar productos

- **View** → abre el producto en una nueva pestaña
- **Remove** → deja de trackear el producto
- **📊 Historial** → abre el modal con gráfico y métricas (requiere ≥2 chequeos)

### 3.3 Ver historial de precios

Una vez el producto tenga **al menos 2 chequeos**:

1. En la tarjeta aparecerá el botón **"📊 Historial"**.
2. Haz clic para abrir el modal.
3. Explora el gráfico interactivo (hover para detalles) y las 4 estadísticas.
4. Cierra con el botón X, clic en overlay o tecla ESC.

---

### 3.4 Chequeos de precio

- Automáticos cada **6 horas** (pausados mientras el popup está abierto)
- Manuales con el botón 🔄 en el popup (útil para forzar una actualización)
- Se añade una entrada de historial en cada chequeo

### 3.4 Notificaciones

Cuando el precio baja ≥5 % respecto al valor anterior:

- Recibirás una notificación de Chrome
- Podrás **ver el producto** o **dejar de trackearlo** directamente

---

## 4. Configurar URLs de afiliado (opcional)

1. Duplica `.env.example` → `.env`
2. Rellena tus IDs de afiliado

```env
AFFILIATE_AMAZON_TAG=tu-tag
AFFILIATE_ADMITAD_ID=tu-id
AFFILIATE_EBAY_ID=tu-id
```

3. Ejecuta `npm run build`
4. Recarga la extensión en `chrome://extensions`

---

## 5. Solución de problemas

| Problema | Solución |
| --- | --- |
| No aparece el botón "Track Price" | Verifica que la URL sea compatible y recarga la página |
| La extensión no se carga | Comprueba que existe `dist/manifest.json` y revisa `chrome://extensions` |
| No se actualizan los precios | Pulsa 🔄 en el popup o revisa los logs del service worker |
| No salen notificaciones | Asegúrate de que el precio se reduce ≥5 % y que Chrome permite notificaciones |

### Logs útiles

- **Service worker**: `chrome://extensions` → "Service worker" → pestaña Console
- **Storage**: en DevTools → Console →
  ```js
  chrome.storage.sync.get('priceTrackerData', console.log);
  ```
- **Alarmas**: 
  ```js
  chrome.alarms.getAll(console.log);
  ```

---

## 6. Próximos pasos

- Explora estadísticas y métricas en el modal de historial
- Configura IDs de afiliado para monetizar
- Revisa la guía de desarrolladores (`docs/DEVELOPER_GUIDE.md`) para extender la extensión

---

¿Dudas o incidencias? Abre un issue en el repositorio Git o contacta con el equipo.
