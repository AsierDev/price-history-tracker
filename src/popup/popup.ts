/**
 * Popup UI logic
 */

import type { TrackedProduct, PriceDataPoint } from '../core/types';
import { StorageManager } from '../core/storage';
import { formatTimestamp } from '../utils/dateUtils';
import { Chart, registerables } from 'chart.js';
import { getProductHistory, getProductImageUrl } from '../backend/backend';

// Register Chart.js components
Chart.register(...registerables);

// DOM Elements
const productsList = document.getElementById('productsList') as HTMLDivElement;
const emptyState = document.getElementById('emptyState') as HTMLDivElement;
const loadingState = document.getElementById('loadingState') as HTMLDivElement;
const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement;
const darkModeToggle = document.getElementById('darkModeToggle') as HTMLButtonElement;
const settingsBtn = document.getElementById('settingsBtn') as HTMLButtonElement;
const totalProducts = document.getElementById('totalProducts') as HTMLSpanElement;
const totalSavings = document.getElementById('totalSavings') as HTMLSpanElement;
const firebaseStatus = document.getElementById('firebaseStatus') as HTMLSpanElement;
const lastUpdate = document.getElementById('lastUpdate') as HTMLSpanElement;

// Settings Modal Elements
const settingsModal = document.getElementById('settingsModal') as HTMLDivElement;
const closeSettingsBtn = document.getElementById('closeSettingsBtn') as HTMLButtonElement;
const saveSettingsBtn = document.getElementById('saveSettingsBtn') as HTMLButtonElement;
const enableNotifications = document.getElementById('enableNotifications') as HTMLInputElement;
const notificationThreshold = document.getElementById('notificationThreshold') as HTMLInputElement;
const thresholdValue = document.getElementById('thresholdValue') as HTMLSpanElement;
const checkInterval = document.getElementById('checkInterval') as HTMLSelectElement;
const firebaseStatusDetail = document.getElementById('firebaseStatusDetail') as HTMLSpanElement;
const testNotificationBtn = document.getElementById('testNotificationBtn') as HTMLButtonElement;
const testFirebaseBtn = document.getElementById('testFirebaseBtn') as HTMLButtonElement;
const clearRateLimitsBtn = document.getElementById('clearRateLimitsBtn') as HTMLButtonElement;

let allProducts: TrackedProduct[] = [];
let filteredProducts: TrackedProduct[] = [];
let currentChart: Chart | null = null;

// Initialize
async function init() {
  await loadProducts();
  setupEventListeners();
  loadDarkMode();
  await updateStatusIndicators();
  await loadSettings();
}

// Load products from storage
async function loadProducts() {
  try {
    showLoading(true);
    allProducts = await StorageManager.getProducts();
    filteredProducts = allProducts;
    renderProducts();
    updateStats();
  } catch (error) {
    console.error('Failed to load products:', error);
  } finally {
    showLoading(false);
  }
}

// Render products
function renderProducts() {
  if (filteredProducts.length === 0) {
    productsList.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  productsList.style.display = 'flex';
  emptyState.style.display = 'none';

  productsList.innerHTML = filteredProducts
    .map(product => createProductCard(product))
    .join('');

  // Attach event listeners to buttons
  // First, remove any existing listeners to prevent memory leaks
  filteredProducts.forEach(product => {
    const historyBtn = document.getElementById(`history-${product.id}`);
    const viewBtn = document.getElementById(`view-${product.id}`);
    const removeBtn = document.getElementById(`remove-${product.id}`);

    if (historyBtn) {
      // Clone and replace to remove existing listeners
      const newHistoryBtn = historyBtn.cloneNode(true) as HTMLButtonElement;
      historyBtn.parentNode?.replaceChild(newHistoryBtn, historyBtn);
      newHistoryBtn.addEventListener('click', () => handleShowHistory(product));
    }

    if (viewBtn) {
      const newViewBtn = viewBtn.cloneNode(true) as HTMLButtonElement;
      viewBtn.parentNode?.replaceChild(newViewBtn, viewBtn);
      newViewBtn.addEventListener('click', () => handleViewProduct(product));
    }

    if (removeBtn) {
      const newRemoveBtn = removeBtn.cloneNode(true) as HTMLButtonElement;
      removeBtn.parentNode?.replaceChild(newRemoveBtn, removeBtn);
      newRemoveBtn.addEventListener('click', () => handleRemoveProduct(product.id));
    }
  });
}

// Create product card HTML
function createProductCard(product: TrackedProduct): string {
  const priceChange = product.currentPrice - product.initialPrice;
  const percentChange = ((priceChange / product.initialPrice) * 100).toFixed(1);
  const changeClass = priceChange < 0 ? 'positive' : priceChange > 0 ? 'negative' : '';
  const changeSymbol = priceChange < 0 ? '↓' : priceChange > 0 ? '↑' : '=';

  return `
    <div class="product-card">
      <div class="product-image loading" id="img-${product.id}"></div>
      <div class="product-info">
        <div class="product-title" title="${product.title}">${product.title}</div>
        <div class="product-prices">
          <span class="current-price">${product.currentPrice.toFixed(2)}${product.currency === 'EUR' ? '€' : product.currency}</span>
          ${product.currentPrice !== product.initialPrice ? `<span class="initial-price">${product.initialPrice.toFixed(2)}€</span>` : ''}
          ${priceChange !== 0 ? `<span class="price-change ${changeClass}">${changeSymbol} ${Math.abs(parseFloat(percentChange))}%</span>` : ''}
        </div>
        <div class="product-meta">
          Added ${formatTimestamp(product.addedAt)} • ${product.adapter === 'generic' ? (product.storeName || 'generic') : product.adapter}
          ${product.adapter === 'generic' && product.customSelector ? '<span class="selector-badge" title="Custom selector: ' + product.customSelector + '">🎯</span>' : ''}
        </div>
      </div>
      <div class="product-actions">
        <button id="history-${product.id}" class="btn btn-chart" title="Ver historial">📊 Historial</button>
        <button id="view-${product.id}" class="btn btn-primary">View</button>
        <button id="remove-${product.id}" class="btn btn-danger">Remove</button>
      </div>
    </div>
  `;
}

// Update stats
function updateStats() {
  totalProducts.textContent = allProducts.length.toString();

  const savings = allProducts.reduce((sum, product) => {
    const diff = product.initialPrice - product.currentPrice;
    return sum + (diff > 0 ? diff : 0);
  }, 0);

  totalSavings.textContent = `${savings.toFixed(2)}€`;
}

// Show/hide loading state
function showLoading(show: boolean) {
  loadingState.style.display = show ? 'block' : 'none';
  productsList.style.display = show ? 'none' : 'flex';
  emptyState.style.display = 'none';
}

// Handle view product
async function handleViewProduct(product: TrackedProduct) {
  try {
    // Send message to service worker to open product with affiliate URL
    await chrome.runtime.sendMessage({
      action: 'openProduct',
      productId: product.id,
    });
  } catch (error) {
    console.error('Failed to open product:', error);
  }
}

// Handle remove product
async function handleRemoveProduct(productId: string) {
  if (!confirm('Are you sure you want to stop tracking this product?')) {
    return;
  }

  try {
    await StorageManager.removeProduct(productId);
    await loadProducts();
  } catch (error) {
    console.error('Failed to remove product:', error);
    alert('Failed to remove product. Please try again.');
  }
}

// Handle search
function handleSearch() {
  const query = searchInput.value.toLowerCase().trim();

  if (!query) {
    filteredProducts = allProducts;
  } else {
    filteredProducts = allProducts.filter(product =>
      product.title.toLowerCase().includes(query)
    );
  }

  renderProducts();
}

// Handle refresh
async function handleRefresh() {
  refreshBtn.disabled = true;
  refreshBtn.style.opacity = '0.5';

  try {
    // Send message to service worker to check prices now
    await chrome.runtime.sendMessage({ action: 'checkPricesNow' });
    
    // Wait a bit then reload
    setTimeout(async () => {
      await loadProducts();
      refreshBtn.disabled = false;
      refreshBtn.style.opacity = '1';
    }, 2000);
  } catch (error) {
    console.error('Failed to refresh:', error);
    refreshBtn.disabled = false;
    refreshBtn.style.opacity = '1';
  }
}

// Handle dark mode toggle
function handleDarkModeToggle() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  darkModeToggle.querySelector('span')!.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

// Load dark mode preference
function loadDarkMode() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  darkModeToggle.querySelector('span')!.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

// Setup event listeners
function setupEventListeners() {
  searchInput.addEventListener('input', handleSearch);
  refreshBtn.addEventListener('click', handleRefresh);
  darkModeToggle.addEventListener('click', handleDarkModeToggle);
  settingsBtn.addEventListener('click', openSettingsModal);
  closeSettingsBtn.addEventListener('click', closeSettingsModal);
  saveSettingsBtn.addEventListener('click', saveSettings);
  testNotificationBtn.addEventListener('click', testNotification);
  testFirebaseBtn.addEventListener('click', testFirebaseConnection);
  clearRateLimitsBtn.addEventListener('click', clearRateLimits);
  enableNotifications.addEventListener('change', handleNotificationToggle);
  
  // Threshold slider
  notificationThreshold.addEventListener('input', () => {
    thresholdValue.textContent = `${notificationThreshold.value}%`;
  });

  // Listen for storage changes (now using local storage)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      // Reload if any product key changed
      const hasProductChange = Object.keys(changes).some(key => key.startsWith('product_'));
      if (hasProductChange) {
        loadProducts();
      }
    }
  });

  // Load images asynchronously after render
  loadProductImages();
}

// Load product images from backend asynchronously with improved performance
async function loadProductImages() {
  const maxConcurrent = 3; // Limit concurrent image loads
  const imagePromises: Promise<void>[] = [];

  for (let i = 0; i < filteredProducts.length; i += maxConcurrent) {
    const batch = filteredProducts.slice(i, i + maxConcurrent);

    // Process batch in parallel
    const batchPromises = batch.map(async (product) => {
      const imgContainer = document.getElementById(`img-${product.id}`);
      if (!imgContainer) return;

      try {
        // Create image element
        const img = document.createElement('img');
        img.className = 'product-image';

        // Set up loading promise with timeout
        const imageLoadPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Image load timeout'));
          }, 8000); // 8 second timeout

          img.onload = () => {
            clearTimeout(timeout);
            img.classList.add('fade-in');
            resolve();
          };

          img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Image failed to load'));
          };
        });

        // Try to get image URL from backend
        const imageUrl = await Promise.race([
          getProductImageUrl(product.url),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('Backend timeout')), 5000)
          )
        ]);

        if (imageUrl) {
          img.src = imageUrl;
          img.alt = product.title;

          // Wait for image to load
          await imageLoadPromise;

          // Replace placeholder with loaded image
          imgContainer.replaceWith(img);
        } else {
          throw new Error('No image URL available');
        }

      } catch (error) {
        console.debug(`Failed to load image for product ${product.id}:`, error);

        // Show error fallback
        const errorImg = document.createElement('div');
        errorImg.className = 'product-image error';
        errorImg.innerHTML = '📦'; // Package emoji as fallback
        errorImg.title = 'Image not available';

        imgContainer.replaceWith(errorImg);
      }
    });

    imagePromises.push(...batchPromises);
  }

  // Wait for all images to finish loading (but don't block UI)
  Promise.allSettled(imagePromises).then((results) => {
    const loaded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.debug(`Image loading complete: ${loaded} loaded, ${failed} failed`);
  }).catch(() => {
    // Ignore errors in Promise.allSettled
  });
}

// Price History Modal Functions
async function handleShowHistory(product: TrackedProduct) {
  const modal = document.getElementById('historyModal') as HTMLDivElement;
  const modalTitle = document.getElementById('modalTitle') as HTMLHeadingElement;
  const closeBtn = document.getElementById('closeModalBtn') as HTMLButtonElement;
  
  // Set title
  modalTitle.textContent = product.title;
  
  // Show modal with loading state
  modal.style.display = 'flex';
  
  try {
    // Fetch history from backend
    const priceHistory = await getProductHistory(product.url);
    
    // Update stats
    updateHistoryStats(product, priceHistory);
    
    // Render chart
    renderPriceChart(product, priceHistory);
  } catch (error) {
    console.error('Failed to load price history', error);
    // Show error or fallback
    modalTitle.textContent = `${product.title} (Error loading history)`;
  }
  
  // Setup close handlers
  closeBtn.onclick = closeHistoryModal;
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeHistoryModal();
    }
  };
  
  // ESC key to close
  document.addEventListener('keydown', handleEscapeKey);
}

function closeHistoryModal() {
  const modal = document.getElementById('historyModal') as HTMLDivElement;
  modal.style.display = 'none';
  
  // Destroy chart instance to free memory
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }
  
  // Remove ESC listener
  document.removeEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeHistoryModal();
  }
}

function updateHistoryStats(product: TrackedProduct, priceHistory: PriceDataPoint[]) {
  const currentPriceEl = document.getElementById('statCurrentPrice') as HTMLSpanElement;
  const initialPriceEl = document.getElementById('statInitialPrice') as HTMLSpanElement;
  const lowestPriceEl = document.getElementById('statLowestPrice') as HTMLSpanElement;
  const highestPriceEl = document.getElementById('statHighestPrice') as HTMLSpanElement;
  
  const currency = product.currency === 'EUR' ? '€' : product.currency;
  
  // Current price
  currentPriceEl.textContent = `${product.currentPrice.toFixed(2)}${currency}`;
  
  // Initial price
  initialPriceEl.textContent = `${product.initialPrice.toFixed(2)}${currency}`;
  
  // Calculate min/max from backend history
  if (priceHistory.length > 0) {
    const prices = priceHistory.map(h => h.price);
    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);
    
    lowestPriceEl.textContent = `${lowest.toFixed(2)}${currency}`;
    highestPriceEl.textContent = `${highest.toFixed(2)}${currency}`;
  } else {
    lowestPriceEl.textContent = `${product.currentPrice.toFixed(2)}${currency}`;
    highestPriceEl.textContent = `${product.currentPrice.toFixed(2)}${currency}`;
  }
}

function renderPriceChart(product: TrackedProduct, priceHistory: PriceDataPoint[]) {
  const canvas = document.getElementById('priceChart') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return;
  
  // Destroy existing chart
  if (currentChart) {
    currentChart.destroy();
  }
  
  // Use backend history (already limited to 500 entries)
  let historyData = [...priceHistory];
  
  // Fallback if no history available
  if (historyData.length === 0) {
    historyData = [{
      price: product.currentPrice,
      currency: product.currency,
      timestamp: product.addedAt,
      source: 'user' as const,
    }];
  }
  
  // Sort by timestamp
  historyData.sort((a, b) => a.timestamp - b.timestamp);
  
  const labels = historyData.map(entry => 
    new Date(entry.timestamp).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short'
    })
  );
  
  const prices = historyData.map(entry => entry.price);
  
  // Detect theme
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  const isDark = theme === 'dark';
  
  // Theme colors
  const textColor = isDark ? '#e2e8f0' : '#4a5568';
  const gridColor = isDark ? 'rgba(74, 85, 104, 0.3)' : 'rgba(226, 232, 240, 0.8)';
  const lineColor = '#3b82f6';
  const fillColor = isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)';
  
  // Create chart
  currentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Precio',
          data: prices,
          borderColor: lineColor,
          backgroundColor: fillColor,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: lineColor,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: isDark ? '#2d3748' : '#ffffff',
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: gridColor,
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            label: (context) => {
              const currency = product.currency === 'EUR' ? '€' : product.currency;
              const price = context.parsed.y ?? 0;
              return `Precio: ${price.toFixed(2)}${currency}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: gridColor,
            display: true,
          },
          ticks: {
            color: textColor,
            maxRotation: 45,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: false,
          grid: {
            color: gridColor,
          },
          ticks: {
            color: textColor,
            callback: function (value) {
              const currency = product.currency === 'EUR' ? '€' : product.currency;
              return `${value}${currency}`;
            },
          },
        },
      },
      interaction: {
        intersect: false,
        mode: 'index',
      },
    },
  });
}

// Update status indicators (Firebase and last update)
async function updateStatusIndicators() {
  try {
    // Check Firebase connection
    const anonymousUserId = await StorageManager.getAnonymousUserId();
    if (anonymousUserId) {
      firebaseStatus.textContent = '🟢 Conectado';
      firebaseStatus.className = 'status-badge connected';
      firebaseStatus.title = `Firebase UID: ${anonymousUserId.substring(0, 8)}...`;
    } else {
      firebaseStatus.textContent = '🔴 No configurado';
      firebaseStatus.className = 'status-badge disconnected';
      firebaseStatus.title = 'Firebase no está configurado. Configura las variables de entorno.';
    }

    // Update last check time
    const lastCheckTime = await StorageManager.getLastCheckTime();
    if (lastCheckTime > 0) {
      lastUpdate.textContent = formatTimestamp(lastCheckTime);
      lastUpdate.title = `Última actualización: ${new Date(lastCheckTime).toLocaleString()}`;
    } else {
      lastUpdate.textContent = 'Nunca';
      lastUpdate.title = 'No se han realizado chequeos automáticos aún';
    }
  } catch (error) {
    console.error('Error updating status indicators:', error);
    firebaseStatus.textContent = '⚪ Error';
    firebaseStatus.className = 'status-badge';
  }
}

// Load current settings
async function loadSettings() {
  try {
    const config = await StorageManager.getConfig();
    
    // Load notification settings
    notificationThreshold.value = config.priceDropThreshold.toString();
    thresholdValue.textContent = `${config.priceDropThreshold}%`;
    enableNotifications.checked = config.notificationsEnabled;
    updateNotificationUIState();

    // Load check interval
    checkInterval.value = config.checkIntervalHours.toString();
    
    // Check Firebase status
    const anonymousUserId = await StorageManager.getAnonymousUserId();
    if (anonymousUserId) {
      firebaseStatusDetail.textContent = `✅ Conectado (UID: ${anonymousUserId.substring(0, 12)}...)`;
      firebaseStatusDetail.className = 'status-detail success';
    } else {
      firebaseStatusDetail.textContent = '❌ No conectado. Firebase necesita configuración.';
      firebaseStatusDetail.className = 'status-detail error';
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Open settings modal
function openSettingsModal() {
  settingsModal.style.display = 'flex';
  loadSettings(); // Reload settings when opening
}

// Close settings modal
function closeSettingsModal() {
  settingsModal.style.display = 'none';
}

// Save settings
async function saveSettings() {
  try {
    const newThreshold = parseInt(notificationThreshold.value);
    const newInterval = parseInt(checkInterval.value);
    
    // Update config
    await StorageManager.updateConfig({
      priceDropThreshold: newThreshold,
      checkIntervalHours: newInterval,
      notificationsEnabled: enableNotifications.checked,
    });

    // Update alarm with new interval
    await chrome.runtime.sendMessage({
      action: 'updateAlarm',
      intervalHours: newInterval,
    });

    // Show success feedback
    saveSettingsBtn.textContent = '✅ Guardado!';
    setTimeout(() => {
      saveSettingsBtn.textContent = '💾 Guardar Configuración';
      closeSettingsModal();
    }, 1500);

    // Reload status indicators
    await updateStatusIndicators();
  } catch (error) {
    console.error('Error saving settings:', error);
    saveSettingsBtn.textContent = '❌ Error';
    setTimeout(() => {
      saveSettingsBtn.textContent = '💾 Guardar Configuración';
    }, 2000);
  }
}

// Test notification
async function testNotification() {
  try {
    testNotificationBtn.disabled = true;
    testNotificationBtn.textContent = '📤 Enviando...';

    await chrome.notifications.create('test-notification', {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('popup/icons/icon128.svg'),
      title: '🎉 Notificación de Prueba',
      message: 'Las notificaciones funcionan correctamente!',
      priority: 2,
    });

    testNotificationBtn.textContent = '✅ Enviada!';
    setTimeout(() => {
      testNotificationBtn.textContent = '🔔 Probar notificación';
      testNotificationBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('Error testing notification:', error);
    testNotificationBtn.textContent = '❌ Error';
    setTimeout(() => {
      testNotificationBtn.textContent = '🔔 Probar notificación';
      testNotificationBtn.disabled = false;
    }, 2000);
  }
}

// Test Firebase connection
async function testFirebaseConnection() {
  try {
    testFirebaseBtn.disabled = true;
    testFirebaseBtn.textContent = '🧪 Probando...';
    firebaseStatusDetail.textContent = '⏳ Comprobando conexión...';
    firebaseStatusDetail.className = 'status-detail';

    // Try to get anonymous user ID (this will authenticate if needed)
    const anonymousUserId = await StorageManager.getAnonymousUserId();
    
    if (anonymousUserId) {
      firebaseStatusDetail.textContent = `✅ Conectado exitosamente! (UID: ${anonymousUserId.substring(0, 12)}...)`;
      firebaseStatusDetail.className = 'status-detail success';
      testFirebaseBtn.textContent = '✅ Conectado!';
    } else {
      firebaseStatusDetail.textContent = '❌ No configurado. Revisa las variables de entorno FIREBASE_*.';
      firebaseStatusDetail.className = 'status-detail error';
      testFirebaseBtn.textContent = '❌ Error';
    }

    setTimeout(() => {
      testFirebaseBtn.textContent = '🧪 Probar conexión Firebase';
      testFirebaseBtn.disabled = false;
    }, 2000);

    // Update header status
    await updateStatusIndicators();
  } catch (error) {
    console.error('Error testing Firebase:', error);
    firebaseStatusDetail.textContent = `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    firebaseStatusDetail.className = 'status-detail error';
    testFirebaseBtn.textContent = '❌ Error';
    setTimeout(() => {
      testFirebaseBtn.textContent = '🧪 Probar conexión Firebase';
      testFirebaseBtn.disabled = false;
    }, 2000);
  }
}

// Clear rate limits
async function clearRateLimits() {
  try {
    clearRateLimitsBtn.disabled = true;
    clearRateLimitsBtn.textContent = '⏳ Limpiando...';

    await chrome.runtime.sendMessage({ action: 'clearAllRateLimits' });

    clearRateLimitsBtn.textContent = '✅ Limpiados!';
    setTimeout(() => {
      clearRateLimitsBtn.textContent = '🔓 Limpiar Rate Limits';
      clearRateLimitsBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('Error clearing rate limits:', error);
    clearRateLimitsBtn.textContent = '❌ Error';
    setTimeout(() => {
      clearRateLimitsBtn.textContent = '🔓 Limpiar Rate Limits';
      clearRateLimitsBtn.disabled = false;
    }, 2000);
  }
}

function handleNotificationToggle(): void {
  updateNotificationUIState();
}

function updateNotificationUIState(): void {
  const notificationsEnabled = enableNotifications.checked;
  notificationThreshold.disabled = !notificationsEnabled;
  testNotificationBtn.disabled = !notificationsEnabled;
  thresholdValue.classList.toggle('disabled', !notificationsEnabled);
}

// Initialize on load
init();

// Notify service worker when popup closes
window.addEventListener('beforeunload', () => {
  chrome.runtime.sendMessage({ action: 'popupClosed' }).catch(() => {
    // Ignore errors if service worker is not available
  });
});

// Notify service worker when popup opens
chrome.runtime.sendMessage({ action: 'popupOpened' }).catch(() => {
  // Ignore errors if service worker is not available
});
