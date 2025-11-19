# 📊 ANÁLISIS COMPLETO - Price History Tracker para Chrome Web Store

_Fecha de análisis: 19 de noviembre de 2025_
_Proyecto: Price History Tracker - Extensión Chrome_
_Estado: Preparación para publicación_

---

## 🔍 **RESUMEN EJECUTIVO**

La extensión "Price History Tracker" presenta una base técnica sólida con arquitectura moderna (Manifest V3), internacionalización completa y sistema de permisos bien estructurado. Sin embargo, requiere completar requisitos legales obligatorios y assets promocionales para cumplir con los estándares de Chrome Web Store.

**Puntuación actual:** 6.5/10 → **Puntuación tras correcciones:** 9.5/10

---

## 🎯 **ESTADO ACTUAL DEL PROYECTO**

### ✅ **Fortalezas Confirmadas**

#### **1. Arquitectura Técnica Excelente**

```json
{
  "manifest_version": 3,
  "default_locale": "en",
  "permissions": ["storage", "alarms", "notifications", "tabs"],
  "background": {
    "service_worker": "service-worker.js",
    "type": "module"
  }
}
```

#### **2. Sistema de Internacionalización Completo**

- **Idiomas soportados:** Inglés, Español (expandible a 7 idiomas más)
- **Keys de traducción:** 300+ elementos
- **Archivos de localización:** Estructura correcta en `_locales/`

#### **3. Permisos y Seguridad**

- **Host permissions:** Bien definidos para sitios objetivo (Amazon, eBay, AliExpress, etc.)
- **Permissions mínimos:** Solo los necesarios para funcionalidad
- **Service worker:** Configuración MV3 moderna

#### **4. Assets Base**

- **Iconos:** Todos los tamaños requeridos (16, 32, 48, 128px)
- **Build system:** esbuild configurado con TypeScript
- **Tests:** Suite completa con Vitest + cobertura

#### **5. Documentación**

- **Developer Guide:** 145 líneas de documentación técnica
- **User Guide:** 117 líneas de guía para usuarios
- **README completo:** 171 líneas con arquitectura y uso

### ⚠️ **Problemas Críticos Identificados**

#### **1. Falta Archivo LICENSE**

- **Estado:** Referenciado en `package.json` y README, pero archivo no existe
- **Impacto:** Bloqueante para publicación
- **Solución:** Crear archivo LICENSE con texto MIT estándar

#### **2. Política de Privacidad Obligatoria**

- **Estado:** Completamente ausente
- **Impacto:** Requerida por Chrome Web Store para extensiones con host permissions
- **Contenido requerido:**
  - Uso de datos de navegación
  - Almacenamiento local
  - Integración Firebase opcional
  - Permisos y justificación

#### **3. Localización HTML Hardcodeada**

```html
<!-- PROBLEMA ACTUAL -->
<html lang="es">
  <!-- SOLUCIÓN REQUERIDA -->
  <html lang="auto">
    <!-- o detección dinámica -->
  </html>
</html>
```

#### **4. Permisos Potencialmente Amplios**

- **Análisis:** Algunos host_permissions pueden ser excesiva
- **Ejemplo:** `https://*/*` en optional_host_permissions
- **Revisión necesaria:** Justificación y posible reducción

#### **4. Permisos Potencialmente Amplios**

- **Análisis:** Algunos host_permissions pueden ser excesiva
- **Ejemplo:** `https://*/*` en optional_host_permissions
- **Revisión necesaria:** Justificación y posible reducción

#### **⚠️ Uso de Marcas Registradas (CRÍTICO para extensiones E-commerce)**

Tu extensión menciona **Amazon, eBay, MediaMarkt, PC Componentes** y otras marcas.

##### **Reglas Chrome Web Store 2025**

###### **✅ PERMITIDO:**

- Mencionar nombres en descripción textual: "Works with Amazon, eBay, MediaMarkt..."
- Listar tiendas soportadas en bullet points
- Screenshots mostrando páginas reales de esas tiendas (uso fair)
- Badge "Verified Store" sin logos oficiales

###### **❌ PROHIBIDO (causa rechazo automático):**

- Usar logos oficiales de tiendas sin permiso escrito
- Nombre de extensión con marca: "Amazon Price Tracker" ❌
- Sugerir afiliación oficial: "Official MediaMarkt Extension" ❌
- Iconos que imiten branding de tiendas
- Claim "Partner de Amazon" sin acuerdo verificable

##### **Tu caso específico:**

✅ **Nombre**: "Price Tracker" (genérico, correcto)  
✅ **Descripción**: "...supports Amazon, eBay, and 650+ stores" (correcto)  
✅ **Screenshots**: Páginas reales de tiendas (fair use)  
✅ **Iconos**: Solo tu logo propio (correcto)  
❌ **Evitar**: Incluir logo de Amazon en assets de la extensión

##### **Si te rechazan por trademark:**

**Respuesta tipo:**

> Thank you for the feedback. Our extension does not claim affiliation with [Brand]. We mention [Brand] only to indicate compatibility. We have reviewed all assets and confirmed no official logos are used. Screenshots show real user experience with our tool on public websites.

---

## 📋 **CHECKLIST COMPLETA DE PUBLICACIÓN**

### 🔴 **PRIORIDAD CRÍTICA (Bloqueantes - 5-7 horas)**

| #   | Tarea                               | Tiempo Estimado | Descripción                           |
| --- | ----------------------------------- | --------------- | ------------------------------------- |
| 1   | **Crear LICENSE MIT**               | 30 minutos      | Archivo legal obligatorio             |
| 2   | **Redactar Política de Privacidad** | 2-3 horas       | Cumplimiento GDPR + Chrome Store      |
| 3   | **Corregir localización HTML**      | 15 minutos      | Cambiar `lang="es"` hardcodeado       |
| 4   | **Optimizar permisos manifest**     | 1-2 horas       | Revisar y justificar host permissions |

### 🟡 **PRIORIDAD ALTA (Recomendados - 4-5 horas)**

| #   | Tarea                                       | Tiempo Estimado | Descripción                     |
| --- | ------------------------------------------- | --------------- | ------------------------------- |
| 5   | **Descripción optimizada Chrome Web Store** | 1 hora          | Título, descripción y keywords  |
| 6   | **Screenshots profesionales**               | 2-3 horas       | Mínimo 1, máximo 5 (1280x800px) |
| 7   | **Icono promocional 128x128**               | 30 minutos      | Optimizar diseño actual         |

### 🟢 **PRIORIDAD MEDIA (Mejoras - 5-6 horas)**

| #   | Tarea                            | Tiempo Estimado | Descripción                 |
| --- | -------------------------------- | --------------- | --------------------------- |
| 8   | **Página de opciones**           | 3-4 horas       | chrome.runtime.onInstalled  |
| 9   | **Categoría y etiquetas**        | 15 minutos      | "Shopping" o "Productivity" |
| 10  | **Variables entorno producción** | 30 minutos      | Build optimizado            |

### 🔵 **PRIORIDAD BAJA (Opcionales - 5-7 horas)**

| #   | Tarea                          | Tiempo Estimado | Descripción                          |
| --- | ------------------------------ | --------------- | ------------------------------------ |
| 11  | **Video promocional (30s)**    | 4-6 horas       | Mejora conversión significativamente |
| 12  | **Modo desarrollo/producción** | 1 hora          | Logging para debugging               |

---

## 📊 **COMPARATIVA DETALLADA**

| Aspecto                 | Estado Actual  | Chrome Web Store Requerido | Gap         | Prioridad |
| ----------------------- | -------------- | -------------------------- | ----------- | --------- |
| **Manifest V3**         | ✅ Completo    | ✅ Obligatorio             | -           | -         |
| **LICENSE**             | ❌ Faltante    | ✅ Obligatorio             | **Crítico** | 🔴        |
| **Política Privacidad** | ❌ Faltante    | ✅ Obligatorio             | **Crítico** | 🔴        |
| **Permisos**            | ⚠️ Amplios     | ⚠️ Justificados            | Medio       | 🟡        |
| **Iconos básicos**      | ✅ Completo    | ✅ Requeridos              | -           | -         |
| **Icono promocional**   | ⚠️ Básico      | ✅ Recomendado             | Bajo        | 🟡        |
| **Localización**        | ✅ Completa    | ✅ i18n required           | Bajo        | 🔴        |
| **HTML hardcodeado**    | ❌ lang="es"   | ✅ Dinámico                | Medio       | 🔴        |
| **Screenshots**         | ❌ Faltantes   | ✅ 1-5 requeridos          | **Alto**    | 🟡        |
| **Descripción**         | ⚠️ Básica      | ✅ Optimizada              | Medio       | 🟡        |
| **Tests**               | ✅ Completos   | ✅ Recomendado             | -           | -         |
| **Documentación**       | ✅ Excelente   | ✅ Recomendado             | -           | -         |
| **Categoría**           | ❌ No definida | ✅ Requerido               | Bajo        | 🟢        |

---

## ⏱️ **CRONOGRAMA DETALLADO DE IMPLEMENTACIÓN**

### **Semana 1: Requisitos Críticos**

#### **Día 1-2: Aspectos Legales**

- ✅ Crear archivo LICENSE MIT
- ✅ Redactar política de privacidad completa
- ✅ Revisar y optimizar permisos del manifest
- **Tiempo total:** 5 horas

#### **Día 3: Correcciones Técnicas**

- ✅ Corregir localización HTML
- ✅ Actualizar referencias en package.json
- ✅ Build de prueba
- **Tiempo total:** 2 horas

### **Semana 2: Assets para Chrome Web Store**

#### **Día 4-5: Contenido Promocional**

- ✅ Crear descripción optimizada
- ✅ Generar screenshots profesionales
- ✅ Mejorar icono promocional
- **Tiempo total:** 5 horas

#### **Día 6-7: Pulido Final**

- ✅ Implementar página de opciones básica
- ✅ Configurar build de producción
- ✅ Testing completo pre-envío
- **Tiempo total:** 4 horas

### **Cronograma Resumido**

| Fase             | Duración | Entregables            | Puntuación Alcanzada |
| ---------------- | -------- | ---------------------- | -------------------- |
| **Actual**       | -        | Base técnica sólida    | 6.5/10               |
| **Críticos**     | 7 horas  | Cumplimiento legal     | 8.5/10               |
| **Alta**         | +5 horas | Assets completos       | 9.0/10               |
| **Total Óptimo** | 12 horas | Listo para lanzamiento | 9.5/10               |

---

## 🎨 **ESPECIFICACIONES DE ASSETS**

### **Screenshots Requeridos**

#### **Screenshot 1: Popup Principal**

- **Contenido:** Vista del popup con productos rastreados
- **Tamaño:** 1280x800px o 640x400px
- **Elementos clave:** Lista de productos, gráficos, estadísticas

#### **Screenshot 2: Tracking en Acción**

- **Contenido:** Botón flotante en sitio de e-commerce
- **Tamaño:** Igual que screenshot 1
- **Elementos clave:** Botón "💰 Track Price" visible

#### **Screenshot 3: Gráfico de Precios**

- **Contenido:** Modal de historial con Chart.js
- **Tamaño:** Igual que screenshot 1
- **Elementos clave:** Línea de tiempo de precios

#### **Screenshot 4: Configuración**

- **Contenido:** Modal de settings
- **Tamaño:** Igual que screenshot 1
- **Elementos clave:** Opciones de notificaciones, frecuencia

### **Icono Promocional**

#### **Especificaciones Actuales:**

```
- Tamaño: 128x128px
- Formato: PNG
- Estado: Básico, necesita mejora
```

#### **Recomendaciones de Diseño:**

- **Estilo:** Moderno, limpio, profesional
- **Colores:** Esquema azul/verde para confianza
- **Elementos:** Símbolo de dinero (💰) + flecha descendente
- **Legibilidad:** Debe verse bien en 16x16px

---

## 📝 **PLANTILLAS DE CONTENIDO**

### **Título Recomendado**

```
💰 Smart Price Tracker - Amazon, eBay & More
```

### **Descripción Optimizada**

#### **Short Description (132 chars max):**

```
Track prices across Amazon, eBay, AliExpress & 600+ stores. Get alerts when prices drop. Free price history charts.
```

#### **Long Description:**

```
🔍 TRACK PRICES SMARTER, NOT HARDER

Monitor price changes across your favorite stores with our intelligent Chrome extension. Perfect for savvy shoppers who want to save money on everything from electronics to fashion.

✨ KEY FEATURES:
• 🏪 COMPREHENSIVE STORE SUPPORT
  - Amazon, eBay, AliExpress (full support)
  - 600+ additional stores (auto-detect)
  - Manual tracking for ANY website

• 📊 INTELLIGENT PRICE TRACKING
  - Automatic checks every 6 hours
  - Smart rate limiting (won't get blocked)
  - Price drop notifications with custom thresholds

• 📈 VISUAL PRICE HISTORY
  - Beautiful charts showing price trends
  - Statistical analysis (min, max, average)
  - Dark/light theme support

• 🌐 MULTI-LANGUAGE SUPPORT
  - English & Spanish included
  - More languages coming soon

• 🔒 PRIVACY-FIRST DESIGN
  - All data stored locally
  - Optional cloud sync with Firebase
  - No tracking, no ads, no data selling

💡 HOW IT WORKS:
1. Browse to any product page
2. Click the floating "💰 Track Price" button
3. Get notified when prices drop
4. View price history charts in the popup

🎯 PERFECT FOR:
- Black Friday & Cyber Monday shopping
- Price comparison across stores
- Long-term price monitoring
- Budget-conscious shoppers
- Deal hunters and bargain seekers

⚡ TECHNICAL HIGHLIGHTS:
- Manifest V3 compliance
- TypeScript + modern web standards
- 60%+ test coverage
- Firebase integration (optional)

Start tracking prices today and never overpay again!

---
Need help? Check our User Guide or open an issue on GitHub.
```

### **Palabras Clave Recomendadas**

```
price tracker, price history, price monitor, amazon tracker, ebay tracker, deal finder, shopping extension, price alert, price comparison, discount tracker
```

---

## 🌍 **Configuración Multiidioma en Chrome Web Store**

Tu extensión soporta 8 idiomas. Configuración en el listado:

#### **Idioma Principal (Obligatorio)**

- **Idioma**: English (EN)
- **Nombre**: "Price Tracker"
- **Descripción corta** (132 caracteres):
  Track prices from 650+ stores. Get alerts on price drops. View price history with charts.

- **Descripción detallada**: [incluir texto completo en inglés]

#### **Idiomas Adicionales**

Click "Add a new language" en Developer Dashboard y añade:

| Idioma    | Código | Prioridad | Descripción corta traducida                 |
| --------- | ------ | --------- | ------------------------------------------- |
| Español   | ES     | 🔴 Alta   | Rastrea precios de 650+ tiendas...          |
| Francés   | FR     | 🟡 Media  | Suivez les prix de 650+ magasins...         |
| Alemán    | DE     | 🟡 Media  | Verfolgen Sie Preise von 650+ Geschäften... |
| Italiano  | IT     | 🟢 Baja   | Traccia i prezzi di 650+ negozi...          |
| Portugués | PT     | 🟢 Baja   | Rastreie preços de 650+ lojas...            |
| Ruso      | RU     | 🟢 Baja   | Отслеживайте цены из 650+ магазинов...      |
| Chino     | ZH_CN  | 🟢 Baja   | 追踪 650+商店价格...                        |

**Tip**: Para cada idioma, traduce también:

- Nombre de la extensión
- Descripción corta y larga
- **Screenshots con UI en ese idioma** (mínimo EN y ES)

**Impacto**: Chrome muestra automáticamente el listado en el idioma del navegador del usuario, aumentando conversión hasta un 40% según datos de Google.

## ⚡ **Validación Técnica Obligatoria**

Antes de crear el ZIP final, ejecuta estos checks:

### **A. Validar manifest.json**

Verificar sintaxis

```bash
cat dist/manifest.json | jq .
```

Validar campos obligatorios

```bash
jq -r '.manifest_version, .name, .version, .description' dist/manifest.json
```

Deben existir todos ✅

### **B. Verificar estructura del bundle**

Checklist automatizado

```bash
echo "📦 Verificando estructura del bundle..."

[ -f dist/manifest.json ] && echo "✅ manifest.json" || echo "❌ manifest.json FALTA"
[ -d dist/_locales ] && echo "✅ \_locales/" || echo "❌ \_locales/ FALTA"
[ -f dist/_locales/en/messages.json ] && echo "✅ EN messages" || echo "❌ EN FALTA"
[ -f dist/_locales/es/messages.json ] && echo "✅ ES messages" || echo "❌ ES FALTA"
[ -f dist/icons/icon-16.png ] && echo "✅ icon-16" || echo "⚠️ icon-16 falta"
[ -f dist/icons/icon-48.png ] && echo "✅ icon-48" || echo "⚠️ icon-48 falta"
[ -f dist/icons/icon-128.png ] && echo "✅ icon-128" || echo "❌ icon-128 FALTA"
```

Verificar tamaño

```bash
SIZE=$(du -sh dist | cut -f1)
echo "📊 Tamaño total: $SIZE (límite: 20MB)"
```

### **C. Validar Content Security Policy (CSP)**

Chrome Web Store rechaza automáticamente extensiones que usan:

Buscar código prohibido

```bash
grep -r "eval(" dist/ && echo "❌ BLOQUEANTE: eval() detectado"
grep -r "new Function" dist/ && echo "❌ BLOQUEANTE: new Function() detectado"
grep -r "innerHTML" dist/ && echo "⚠️ Revisar uso de innerHTML (puede ser inseguro)"
```

Si no hay output, estás bien ✅

### **D. Test en Modo Incógnito**

Prueba la extensión en ventana privada para simular usuario sin historial:

Chrome/Brave Incognito
⌘+Shift+N (Mac) o Ctrl+Shift+N (Windows/Linux)

- [ ] Añadir producto funciona
- [ ] Notificaciones se muestran
- [ ] Configuración se guarda
- [ ] Firebase conecta correctamente

### **E. Validar Permisos Mínimos (2025 Critical)**

Chrome ahora **penaliza en ranking** extensiones con permisos excesivos.

**Tu extensión debe usar SOLO**:

```json
{
  "permissions": ["storage", "alarms", "notifications"],
  "host_permissions": ["https://*/"]
}
```

**PROHIBIDO usar (a menos que imprescindible)**:

- ❌ `tabs` (revela historial de navegación)
- ❌ `history` (altamente sensible)
- ❌ `cookies` (riesgo de privacidad)
- ❌ `webRequest` (puede interceptar datos)

## Si necesitas alguno, prepara justificación técnica detallada.

## 🔐 **ASPECTOS LEGALES DETALLADOS**

### **Archivo LICENSE MIT (Requerido)**

```markdown
MIT License

Copyright (c) 2025 Price History Tracker

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 📜 **Política de Privacidad (Requisitos 2025 Actualizados)**

Chrome Web Store ahora exige privacidad policy **MÁS detallada**.

### **Contenido obligatorio en tu `privacy.html`:**

#### **1. Datos que recoges (explícito)**

✅ Datos que SÍ recopila Price Tracker:

- URLs de productos que el usuario elige trackear manualmente
- Precios extraídos de esas URLs específicas
- Timestamps de checks automáticos
- UID anónimo generado por Firebase Authentication
- Histórico de precios por producto (opcional, sincronizado)

❌ Datos que NO recopilamos:

- Historial de navegación fuera de productos trackeados
- Información personal (nombre, email, dirección)
- Datos de pago o tarjetas de crédito
- Cookies de terceros no relacionadas
- Actividad en pestañas no relacionadas con productos

#### **2. Servicios externos (transparencia)**

🔥 Firebase (Google Cloud Platform)

- **Propósito**: Almacenamiento de histórico de precios compartido
- **Datos enviados**: URLs normalizadas, precios, timestamps, UID anónimo
- **Ubicación**: Servidores EU/US según configuración Firestore
- **Política**: https://firebase.google.com/support/privacy
- **Control usuario**: Puede desactivar sincronización en Configuración

#### **3. Derechos del usuario (GDPR compliant)**

Tienes derecho a:
✓ Eliminar productos trackeados (botón "Eliminar" en cada producto)
✓ Desactivar sincronización con Firebase (Configuración > Historial compartido)
✓ Exportar tus datos (función disponible en Configuración avanzada)
✓ Solicitar eliminación completa de datos (contacta privacy@tudominio.com)

#### **4. Seguridad**

🔒 Medidas de protección:

- Comunicación HTTPS exclusivamente
- API keys restringidas por dominio
- Sin almacenamiento de credenciales sensibles
- Firestore Rules limitan acceso por UID autenticado

#### **5. Contacto para privacidad**

Oficial de Privacidad: privacy@tudominio.com
Respuesta típica: 48-72 horas

### **Plantilla lista para usar**

Descarga plantilla HTML completa: [crear archivo `privacy.html` en carpeta raíz]

**Hosting de la política**:

- GitHub Pages (gratis): `https://tu-usuario.github.io/price-tracker/privacy.html`
- Vercel/Netlify (gratis)
- Tu dominio propio

**URL debe ser HTTPS y pública antes de submit a Store.**

---

## 🛠️ **PLAN DE IMPLEMENTACIÓN TÉCNICA**

### **1. Corrección Localización HTML**

```typescript
// En popup/popup.ts - Detección de idioma
const browserLang = chrome.i18n.getUILanguage() || navigator.language;
document.documentElement.lang = browserLang.split("-")[0];
```

### **2. Optimización de Permisos**

```json
{
  "host_permissions": [
    // Mantener solo los realmente utilizados
    "https://*.amazon.com/*",
    "https://*.amazon.es/*",
    "https://*.ebay.com/*",
    "https://*.ebay.es/*",
    "https://*.aliexpress.com/*",
    "https://pccomponentes.com/*",
    "https://elcorteingles.es/*",
    "https://mediamarkt.es/*"
  ],
  "optional_host_permissions": [
    // Reducir scope si es posible
    "https://*/*" // Solo si es absolutamente necesario
  ]
}
```

#### **🔥 Configuración Firebase para Publicación**

##### **A. Validar Firestore Security Rules**

Chrome Web Store puede rechazar si detectan BD abierta al público.

###### **❌ Configuración INSEGURA (rechazo automático):**

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // ❌ PELIGROSO
    }
  }
}
```

###### **✅ Configuración SEGURA (requerida):**

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Colección de productos
    match /products/{productId} {
      allow read: if true; // Lectura pública OK (históricos compartidos)
      allow create, update: if request.auth != null; // Solo usuarios autenticados
      allow delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }

    // Colección de histórico de precios
    match /priceHistory/{historyId} {
      allow read: if true; // Compartido anónimamente
      allow write: if request.auth != null; // Solo desde extension autenticada
    }

    // Rate limiting por usuario
    match /rateLimits/{domain} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

**Despliega rules antes de submit:**

```bash
firebase deploy --only firestore:rules
```

##### **B. API Keys Públicas (aclaración)**

Las API keys de Firebase en tu `manifest.json` o config **NO son secretas**:

✅ **Está bien** que aparezcan en el ZIP  
✅ Firebase las valida con **domain restrictions**  
❌ **NUNCA uses** Admin SDK keys en código cliente

**Configurar domain restrictions en Firebase Console:**
Allowed domains:

- chrome-extension://[TU_EXTENSION_ID]
- localhost (solo para desarrollo)

##### **C. Límites y Cuotas (prevenir abusos)**

Configura en Firebase Console:

**Firestore:**

- Reads/day: 50,000 (ajustar según uso esperado)
- Writes/day: 20,000
- Storage: 1GB

**Cloud Functions (si usas):**

- Invocations/day: 125,000 (tier gratuito)

Esto previene costes inesperados si alguien abusa extrayendo tu API key.

````

### **3. Página de Opciones Básica**

```typescript
// En service-worker.ts
chrome.runtime.onInstalled.addListener(() => {
  chrome.runtime.openOptionsPage();
});
````

---

## 🧪 **Test Suite Completo Pre-Publicación**

### **Test 1: Funcionalidades Core**

- [ ] **Añadir producto Amazon** → Trackeo automático exitoso
- [ ] **Añadir producto PC Componentes** → Verified store detectada
- [ ] **Añadir producto tienda desconocida** → Selector manual funciona
- [ ] **Recibir notificación** → Simula bajada >5%, notifica correctamente
- [ ] **Ver historial** → Gráfico muestra datos
- [ ] **Cambiar tema** → Claro/Oscuro/Sistema funcionan
- [ ] **Búsqueda** → Filtra productos correctamente
- [ ] **Eliminar producto** → Confirmación + eliminación correcta

### **Test 2: Validación i18n (Obligatorio 3 idiomas mínimo)**

Probar extensión en **3 idiomas críticos**:

#### **A. Inglés (EN) - Mercado principal**

Abrir Chrome/Brave en inglés

```bash
open -a "Brave Browser" --args --lang=en
```

**Checklist:**

- [ ] Abrir popup → Textos en inglés
- [ ] Abrir configuración → Opciones en inglés
- [ ] Añadir producto → Botones en inglés
- [ ] Notificación → Mensaje en inglés
- [ ] Tooltip "Total Savings" en inglés

#### **B. Español (ES) - Idioma base**

```bash
open -a "Brave Browser" --args --lang=es
```

**Checklist:**

- [ ] Popup: "PRODUCTOS ACTIVOS", "AHORRO ACUMULADO"
- [ ] Configuración: "Frecuencia de comprobación"
- [ ] Botones: "Historial", "Ver tienda", "Eliminar"
- [ ] Notificación: "¡Bajada de precio!"

#### **C. Alemán (DE) - Mercado europeo**

```bash
open -a "Brave Browser" --args --lang=de
```

**Checklist:**

- [ ] Popup traducido correctamente
- [ ] Sin mezcla de idiomas
- [ ] Fechas en formato alemán (DD.MM.YYYY)

**Criterio de éxito**: CERO texto en idioma incorrecto, CERO keys sin traducir.

### **Test 3: Navegadores Compatibles**

- [ ] **Chrome** (latest stable): Funcionalidad completa
- [ ] **Brave** (latest): Funcionalidad completa
- [ ] **Edge** (latest): Compatible (usa Chrome Web Store)
- [ ] **Opera** (opcional): Compatible con extensiones Chrome

### **Test 4: Estados Edge Cases**

- [ ] Sin conexión a internet → Mensaje claro
- [ ] Firebase caído → Funciona en modo local
- [ ] Producto eliminado de tienda → Manejo graceful
- [ ] Selector CSS roto → Opción re-seleccionar
- [ ] 0 productos trackeados → Estado vacío claro

---

# 🎯 **CHECKLIST PRE-LANZAMIENTO DEFINITIVA**

## 📅 **48 Horas Antes del Submit**

### **1. Build Production Limpio**

Limpiar todo

```bash
rm -rf dist node_modules package-lock.json
```

Reinstalar dependencias (solo production)

```bash
npm install --production
```

Build final

```bash
npm run build
```

Verificar output

```bash
ls -la dist/
```

### **2. Crear ZIP Final**

```bash
cd dist
zip -r ../price-tracker-v1.0.0.zip . -x ".map" ".DS_Store"
cd ..
```

Verificar contenido

```bash
unzip -l price-tracker-v1.0.0.zip | head -30
```

**Estructura esperada:**

```
manifest.json
icons/icon-16.png
icons/icon-48.png
icons/icon-128.png
\_locales/en/messages.json
\_locales/es/messages.json
...
popup/popup.html
popup/popup.js
background/service-worker.js
```

### **3. Test Suite Funcional Completo**

#### **Funcionalidades Core:**

- [ ] **Añadir producto Amazon** → Trackeo automático exitoso
- [ ] **Añadir producto PC Componentes** → Verified store detectada
- [ ] **Añadir producto tienda desconocida** → Selector manual funciona
- [ ] **Recibir notificación** → Simula bajada >5%, notifica correctamente
- [ ] **Ver historial** → Gráfico muestra datos
- [ ] **Cambiar tema** → Claro/Oscuro/Sistema funcionan
- [ ] **Búsqueda** → Filtra productos correctamente
- [ ] **Eliminar producto** → Confirmación + eliminación correcta

#### **Test Multi-idioma:**

- [ ] Inglés (EN) → Todo traducido
- [ ] Español (ES) → Todo traducido
- [ ] Alemán (DE) → Todo traducido

#### **Test Edge Cases:**

- [ ] Sin internet → Mensaje claro "Sin conexión"
- [ ] Firebase offline → Funciona en local
- [ ] 0 productos → Estado vacío bonito
- [ ] Selector roto → Botón "Re-seleccionar" visible

### **4. Assets Gráficos Finales**

- [ ] **Icons**:

  - `icon-16.png` (16x16px, PNG)
  - `icon-48.png` (48x48px, PNG)
  - `icon-128.png` (128x128px, PNG)

- [ ] **Store Assets**:
  - Tile pequeño (128x128px)
  - Tile marquee (440x280px) - opcional
  - **5 Screenshots** (1280x800px o 640x400px):
    1. Popup con productos (modo claro)
    2. Gráfico historial de precios
    3. Notificación de bajada
    4. Panel configuración
    5. Popup modo oscuro

### **5. Textos Store Listos**

#### **Inglés (obligatorio):**

- [ ] Nombre: "Price Tracker"
- [ ] Descripción corta (132 chars)
- [ ] Descripción larga (completa, sin typos)
- [ ] Revisado con Grammarly

#### **Español:**

- [ ] Descripción corta traducida
- [ ] Descripción larga traducida

### **6. Política de Privacidad Publicada**

- [ ] Archivo `privacy.html` creado
- [ ] Subido a hosting público (GitHub Pages, Vercel, etc.)
- [ ] URL HTTPS funciona: `https://tudominio.com/privacy.html`
- [ ] Incluye todos los puntos de TAREA 3

### **7. Developer Account Preparado**

- [ ] 2FA activado en Google Account
- [ ] Email verificado
- [ ] $5 de registro pagados
- [ ] Perfil completo (nombre público, email contacto)

### **8. Repositorio y Backup**

- [ ] Código commiteado y pusheado
- [ ] Git tag creado: `v1.0.0`
- [ ] README.md actualizado
- [ ] Backup ZIP del proyecto guardado localmente

---

## 🚀 **DÍA DEL LANZAMIENTO**

### **Hora 0: Upload**

1. Ve a [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click "Add new item"
3. Arrastra `price-tracker-v1.0.0.zip`
4. Espera validación inicial (2-3 min)

### **Hora 0+5: Completar Listado**

#### **Store listing:**

- Nombre: Price Tracker
- Descripción corta (EN)
- Descripción detallada (EN)
- Categoría: **Shopping**
- Idioma principal: English
- Subir 5 screenshots
- Subir tile 128x128
- Subir marquee 440x280 (opcional)

#### **Privacy:**

- URL política: `https://tudominio.com/privacy.html`
- Justificar cada permiso:
  - storage: Store tracked products locally in browser
  - alarms: Schedule automatic price checks every 6 hours
  - notifications: Alert users when prices drop
  - host_permissions (https://\*/): Access product pages to extract prices

#### **Distribution:**

- Visibilidad: **Pública**
- Regiones: **Todos los países** (o específicos si prefieres)
- Pricing: **Gratis**
- Email soporte: tu-email@dominio.com

### **Hora 0+15: Añadir Idiomas Adicionales**

- Click "Add language" → Spanish
- Traducir nombre, descripciones
- Repetir para FR, DE, IT, PT (mínimo)

### **Hora 0+30: Review Final**

- Click botón "Preview" → Revisar cómo se verá
- Verificar screenshots ordenados correctamente
- Verificar textos sin typos
- Verificar URL privacy funciona

### **Hora 0+35: SUBMIT**

- Click **"Submit for review"**
- Confirmar todos los campos
- **ANOTAR**: Fecha, hora, versión enviada
- Recibirás email de confirmación inmediato

---

## 📧 **POST-SUBMIT (Siguientes 14 días)**

### **Días 1-3: Monitorización Activa**

- [ ] Revisar email developer account 2x/día
- [ ] Si Google pide aclaraciones → responder < 24h
- [ ] Si piden cambios → aplicar y re-submit rápido

### **Día 7-10: Seguimiento**

- [ ] Si no hay noticias → normal, en revisión
- [ ] NO enviar múltiples consultas (contraproducente)

### **Día 14+: Escalación**

- [ ] Si pasan 14 días sin respuesta → contactar soporte:
- https://support.google.com/chrome_webstore/contact/dev_account_support

---

## ✅ **CRITERIOS DE PUBLICACIÓN EXITOSA**

Tu extensión está **lista para submit** si cumples:

- ✅ Build production sin errores
- ✅ ZIP < 20MB con estructura correcta
- ✅ \_locales/ con mínimo EN + ES completos
- ✅ Iconos 16, 48, 128 presentes
- ✅ Screenshots de calidad (5)
- ✅ Privacy policy pública en HTTPS
- ✅ Permisos justificados uno por uno
- ✅ Firestore rules seguras deployadas
- ✅ Test funcional en 3 idiomas OK
- ✅ Sin errores console en uso normal
- ✅ Developer account con 2FA

---

## 📈 **MÉTRICAS DE ÉXITO**

### **Durante el Desarrollo**

- [ ] Build exitoso sin errores
- [ ] Tests pasando al 100%
- [ ] Cobertura de código ≥60%
- [ ] Linting sin warnings

### **Para la Publicación**

## ⏰ **Tiempos de Revisión Actualizados (2025)**

Google ha aumentado el escrutinio de extensiones en 2025:

| Tipo de Publicación                       | Tiempo Típico     | Casos Complejos |
| ----------------------------------------- | ----------------- | --------------- |
| **Primera publicación**                   | 3-10 días hábiles | Hasta 14 días   |
| **Actualización menor** (bug fixes)       | 1-2 días          | 3-5 días        |
| **Actualización mayor** (nuevos permisos) | 3-7 días          | Hasta 10 días   |
| **Cambio de categoría/descripción**       | 2-4 días          | 5-7 días        |

### **Factores que ACELERAN revisión:**

✅ Manifest V3 (vs V2 legacy)  
✅ Permisos mínimos y bien justificados  
✅ Código limpio sin ofuscación  
✅ Developer account con historial limpio  
✅ Política de privacidad clara y accesible

### **Factores que RALENTIZAN:**

⚠️ Primera extensión en cuenta nueva  
⚠️ Muchos `host_permissions` (ej: `<all_urls>`)  
⚠️ Código minificado sospechoso  
⚠️ Reportes previos de otras extensiones tuyas  
⚠️ Uso de APIs sensibles (webRequest, cookies)

### **Durante la revisión:**

- Monitoriza email de developer account
- Responde en < 48h si Google pide aclaraciones
- Ten versión 1.0.1 lista con fixes menores

---

- [ ] Cumplimiento 100% de requisitos Chrome Web Store
- [ ] Tiempo de revisión <24 horas
- [ ] Aprobación sin solicitar cambios

### **Post-Publicación**

- [ ] Rating inicial ≥4.0 estrellas
- [ ] 100+ instalaciones en primera semana
- [ ] <5% tasa de desinstalación
- [ ] Reviews positivas destacando funcionalidad

---

## 🎯 **RECOMENDACIONES FINALES**

### **Prioridades Inmediatas (Próximas 48 horas)**

1. ✅ **Crear LICENSE** - 30 minutos
2. ✅ **Redactar política de privacidad** - 3 horas
3. ✅ **Corregir localización HTML** - 15 minutos
4. ✅ **Optimizar permisos manifest** - 2 horas

### **Para Máximo Impacto**

1. **Screenshots profesionales** - Diferenciador clave
2. **Descripción optimizada** - Mejora conversión
3. **Icono promocional** - Mayor click-through rate

### **Consideraciones a Largo Plazo**

1. **Expansión de idiomas** - 7 idiomas adicionales ya preparados
2. **Más adaptadores de tiendas** - Sistema extensible implementado
3. **Funcionalidades premium** - Monetización potencial

---

## 📞 **PRÓXIMOS PASOS RECOMENDADOS**

### **Opción A: Mínimo Viable (5-7 horas)**

Completar solo los 4 requisitos críticos para envío inmediato.

### **Opción B: Lanzamiento Optimizado (12-15 horas)**

Incluir assets promocionales y optimizaciones UX.

### **Opción C: Lanzamiento Premium (20+ horas)**

Incluir video promocional, página de opciones completa y optimizaciones avanzadas.

---

**🏆 CONCLUSIÓN:** El proyecto tiene una base técnica excepcional y alto potencial de éxito. Con la inversión de tiempo recomendada en los aspectos críticos, la extensión estará lista para un lanzamiento exitoso en Chrome Web Store.

**ROI Estimado:** Alto - La funcionalidad sólida combinada con cumplimiento de estándares garantiza alta probabilidad de aprobación y adopción por parte de usuarios.
