# Firebase Setup Guide

Esta guía explica cómo configurar Firebase para el backend de historial compartido.

## Resumen

La extensión usa Firebase para:
- **Firestore**: Almacenar historial de precios compartido entre usuarios
- **Authentication (Anonymous)**: Autenticación transparente sin registro

## Paso 1: Crear Proyecto Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Click en "Add project" / "Agregar proyecto"
3. Nombre del proyecto: `price-history-tracker` (o el que prefieras)
4. Deshabilita Google Analytics (opcional para MVP)
5. Click "Create project"

## Paso 2: Habilitar Firestore Database

1. En el menú lateral, ve a **Build → Firestore Database**
2. Click "Create database"
3. Selecciona modo: **Start in test mode** (para desarrollo)
   - Nota: Cambiar a production mode después con reglas de seguridad
4. Selecciona ubicación: `europe-west1` (o la más cercana)
5. Click "Enable"

## Paso 3: Configurar Security Rules

En Firestore → Rules, reemplaza con:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{productId} {
      // Permitir lectura a todos
      allow read: if true;
      
      // Permitir escritura solo a usuarios autenticados (incluso anónimos)
      allow write: if request.auth != null;
    }
  }
}
```

Click "Publish"

## Paso 4: Habilitar Anonymous Authentication

1. En el menú lateral, ve a **Build → Authentication**
2. Click "Get started"
3. En la pestaña "Sign-in method"
4. Click en "Anonymous"
5. Toggle "Enable" → ON
6. Click "Save"

## Paso 5: Obtener Credenciales Web App

1. En Project Overview (⚙️ Settings)
2. Scroll down a "Your apps"
3. Click en el ícono web `</>`
4. Nombre de la app: `price-tracker-extension`
5. **NO** marcar "Also set up Firebase Hosting"
6. Click "Register app"
7. Copia el objeto `firebaseConfig`:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Paso 6: Configurar Variables de Entorno

1. Crea un archivo `.env` en la raíz del proyecto (copia de `.env.example`)
2. Rellena las variables de Firebase:

```bash
# Firebase Configuration
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123
```

## Paso 7: Build y Test

```bash
npm run build
```

Carga la extensión en Chrome y verifica:
1. Agregar un producto → debe aparecer en Firestore Console
2. Múltiples usuarios agregando el mismo producto → historial compartido
3. Gráfico de precios muestra datos previos

## Estructura de Datos en Firestore

### Collection: `products`

Cada documento representa un producto único (identificado por URL limpia):

```javascript
{
  url: "https://amazon.es/dp/B06XGW29XJ",
  title: "Helly Hansen Dubliner...",
  platform: "amazon",
  imageUrl: "https://m.media-amazon.com/...",
  priceHistory: [
    {
      price: 68.00,
      currency: "EUR",
      timestamp: 1699000000000,
      source: "user"  // o "check"
    },
    // ... más entradas
  ],
  lastUpdated: 1699200000000,
  contributorCount: 15
}
```

## Límites del Tier Gratuito

Firebase Spark Plan (gratuito):
- **Firestore**: 50K reads/day, 20K writes/day, 1GB storage
- **Authentication**: Unlimited anonymous users
- **Bandwidth**: 10GB/month

Suficiente para ~1000-5000 usuarios activos en MVP.

## Monitoreo

### Firestore Console
- Ve a Firestore Database → Data
- Verifica que los productos se están creando correctamente
- Revisa el tamaño de `priceHistory` (limitado a 500 entradas por producto)

### Authentication Console
- Ve a Authentication → Users
- Verás usuarios anónimos con UID único
- No se almacena información personal

## Troubleshooting

### Error: "Firebase not configured"
- Verifica que `.env` tiene todas las variables
- Rebuild: `npm run build`
- Revisa console logs en DevTools

### Error: "Permission denied"
- Verifica Security Rules en Firestore
- Asegúrate que Anonymous Auth está habilitado
- Revisa que el usuario se autenticó (check `chrome.storage.local` → `anonymousUserId`)

### Build falla con errores de Firebase
- Asegúrate que `firebase` está instalado: `npm install firebase`
- Verifica que `esbuild.config.js` tiene las variables de entorno

## Migración a Production

Cuando estés listo para producción:

1. **Security Rules más estrictas**:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{productId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null 
        && request.resource.data.priceHistory.size() <= 500;
      allow delete: if false; // No permitir borrado
    }
  }
}
```

2. **Índices compuestos** (si necesitas queries complejas):
   - Firestore → Indexes
   - Crear índices para queries frecuentes

3. **Monitoreo de costos**:
   - Firebase Console → Usage and billing
   - Configurar alertas de presupuesto

4. **Rate limiting adicional**:
   - Implementar Cloud Functions para validación
   - Limitar writes por usuario/IP

## Arquitectura de Fallback

Si Firebase falla o no está configurado:
- ✅ Extensión funciona en modo local-only
- ✅ Productos se guardan en `chrome.storage.local`
- ❌ No hay historial compartido
- ❌ Gráficos solo muestran datos desde que el usuario agregó el producto

Logs indicarán: `"Firebase not configured, skipping backend sync"`
