/**
 * Popup UI logic
 */

import type { TrackedProduct, PriceDataPoint } from "../core/types";
import { StorageManager } from "../core/storage";
import { formatTimestamp } from "../utils/dateUtils";
import { Chart, registerables } from "chart.js";
import { getProductHistory, getProductImageUrl } from "../backend/backend";
import { t, translatePage } from "../utils/i18n";

// Register Chart.js components
Chart.register(...registerables);

type SortOption = "date" | "store" | "price" | "discount";
type HistoryRange = "7" | "30" | "all";
type ThemePreference = "light" | "dark" | "system";

// DOM Elements
const productsList = document.getElementById("productsList") as HTMLDivElement;
const emptyState = document.getElementById("emptyState") as HTMLDivElement;
const loadingState = document.getElementById("loadingState") as HTMLDivElement;
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const refreshBtn = document.getElementById("refreshBtn") as HTMLButtonElement;
const darkModeToggle = document.getElementById(
  "darkModeToggle"
) as HTMLButtonElement;
const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement;
const totalProducts = document.getElementById(
  "totalProducts"
) as HTMLSpanElement;
const totalSavings = document.getElementById("totalSavings") as HTMLSpanElement;
const connectionHint = document.getElementById(
  "connectionHint"
) as HTMLSpanElement | null;
const settingsConnectionStatus = document.getElementById(
  "settingsConnectionStatus"
) as HTMLSpanElement;
const settingsLastSync = document.getElementById(
  "settingsLastSync"
) as HTMLSpanElement;
const sortSelect = document.getElementById("sortSelect") as HTMLSelectElement;
const themePreference = document.getElementById(
  "themePreference"
) as HTMLSelectElement;
const floatingButtonBehavior = document.getElementById(
  "floatingButtonBehavior"
) as HTMLSelectElement;
const rangeButtons = Array.from(
  document.querySelectorAll(".range-btn")
) as HTMLButtonElement[];
const historyExpandBtn = document.getElementById(
  "historyExpandBtn"
) as HTMLButtonElement;
const historyModalContent = document.querySelector(
  "#historyModal .modal-content"
) as HTMLDivElement;

// Settings Modal Elements
const settingsModal = document.getElementById(
  "settingsModal"
) as HTMLDivElement;
const closeSettingsBtn = document.getElementById(
  "closeSettingsBtn"
) as HTMLButtonElement;
const saveSettingsBtn = document.getElementById(
  "saveSettingsBtn"
) as HTMLButtonElement;
const enableNotifications = document.getElementById(
  "enableNotifications"
) as HTMLInputElement;
const notificationThreshold = document.getElementById(
  "notificationThreshold"
) as HTMLInputElement;
const thresholdValue = document.getElementById(
  "thresholdValue"
) as HTMLSpanElement;
const checkInterval = document.getElementById(
  "checkInterval"
) as HTMLSelectElement;
const firebaseStatusDetail = document.getElementById(
  "firebaseStatusDetail"
) as HTMLSpanElement;
const testNotificationBtn = document.getElementById(
  "testNotificationBtn"
) as HTMLButtonElement;
const testFirebaseBtn = document.getElementById(
  "testFirebaseBtn"
) as HTMLButtonElement;
const clearRateLimitsBtn = document.getElementById(
  "clearRateLimitsBtn"
) as HTMLButtonElement;
const BUTTON_COLLAPSE_KEY = "phtButtonCollapsed";
const THEME_STORAGE_KEY = "themePreference";

let allProducts: TrackedProduct[] = [];
let filteredProducts: TrackedProduct[] = [];
let currentChart: Chart | null = null;
let currentSortOption: SortOption = "date";
let currentHistoryRange: HistoryRange = "30";
let historyDataCache: PriceDataPoint[] = [];
let activeHistoryProduct: TrackedProduct | null = null;
let isHistoryExpanded = false;
let currentThemePreference: ThemePreference = "light";
const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

// Initialize
async function init() {
  translatePage();
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
    applyFilters();
    updateStats();
  } catch (error) {
    console.error("Failed to load products:", error);
  } finally {
    showLoading(false);
  }
}

// Render products
function renderProducts() {
  if (filteredProducts.length === 0) {
    productsList.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  productsList.style.display = "flex";
  emptyState.style.display = "none";

  productsList.innerHTML = filteredProducts
    .map((product) => createProductCard(product))
    .join("");

  // Attach event listeners to buttons
  // First, remove any existing listeners to prevent memory leaks
  filteredProducts.forEach((product) => {
    const historyBtn = document.getElementById(`history-${product.id}`);
    const viewBtn = document.getElementById(`view-${product.id}`);
    const removeBtn = document.getElementById(`remove-${product.id}`);

    if (historyBtn) {
      // Clone and replace to remove existing listeners
      const newHistoryBtn = historyBtn.cloneNode(true) as HTMLButtonElement;
      historyBtn.parentNode?.replaceChild(newHistoryBtn, historyBtn);
      newHistoryBtn.addEventListener("click", () => handleShowHistory(product));
    }

    if (viewBtn) {
      const newViewBtn = viewBtn.cloneNode(true) as HTMLButtonElement;
      viewBtn.parentNode?.replaceChild(newViewBtn, viewBtn);
      newViewBtn.addEventListener("click", () => handleViewProduct(product));
    }

    if (removeBtn) {
      const newRemoveBtn = removeBtn.cloneNode(true) as HTMLButtonElement;
      removeBtn.parentNode?.replaceChild(newRemoveBtn, removeBtn);
      newRemoveBtn.addEventListener("click", () =>
        handleRemoveProduct(product.id)
      );
    }
  });

  loadProductImages();
}

// Create product card HTML
function formatAdapterLabel(adapter: string): string {
  if (adapter === "generic") {
    return "Manual";
  }
  return adapter
    .split(/[-_]/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function createProductCard(product: TrackedProduct): string {
  const priceChange = product.currentPrice - product.initialPrice;
  const percentChange = ((priceChange / product.initialPrice) * 100).toFixed(1);
  const changeClass =
    priceChange < 0 ? "positive" : priceChange > 0 ? "negative" : "";
  const changeSymbol = priceChange < 0 ? "↓" : priceChange > 0 ? "↑" : "=";
  const displayStore = getStoreDisplayName(product);

  return `
    <div class="product-card">
      <div class="product-image loading" id="img-${product.id}"></div>
      <div class="product-info">
        <div class="product-title" title="${product.title}">${
    product.title
  }</div>
        <div class="product-prices">
          <span class="current-price">${product.currentPrice.toFixed(2)}${
    product.currency === "EUR" ? "€" : product.currency
  }</span>
          ${
            product.currentPrice !== product.initialPrice
              ? `<span class="initial-price">${product.initialPrice.toFixed(
                  2
                )}€</span>`
              : ""
          }
          ${
            priceChange !== 0
              ? `<span class="price-change ${changeClass}">${changeSymbol} ${Math.abs(
                  parseFloat(percentChange)
                )}%</span>`
              : ""
          }
        </div>
        <div class="product-meta">
          ${t("addedOn")} ${formatTimestamp(product.addedAt)} • ${displayStore}
          ${
            product.adapter === "generic" && product.customSelector
              ? '<span class="selector-badge" title="Selector personalizado: ' +
                product.customSelector +
                '">🎯</span>'
              : ""
          }
        </div>
      </div>
      <div class="product-actions">
        <button id="history-${product.id}" class="btn btn-chart" title="${t(
    "historyButton"
  )}">📊 ${t("historyButton")}</button>
        <button id="view-${product.id}" class="btn btn-primary">${t(
    "viewStoreButton"
  )}</button>
        <button id="remove-${product.id}" class="btn btn-danger">${t(
    "removeButton"
  )}</button>
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
  loadingState.style.display = show ? "block" : "none";
  productsList.style.display = show ? "none" : "flex";
  emptyState.style.display = "none";
}

// Handle view product
async function handleViewProduct(product: TrackedProduct) {
  try {
    // Send message to service worker to open product with affiliate URL
    await chrome.runtime.sendMessage({
      action: "openProduct",
      productId: product.id,
    });
  } catch (error) {
    console.error("Failed to open product:", error);
  }
}

// Handle remove product
async function handleRemoveProduct(productId: string) {
  if (!confirm(t("confirmRemoveProduct"))) {
    return;
  }

  try {
    await StorageManager.removeProduct(productId);
    await loadProducts();
  } catch (error) {
    console.error("Failed to remove product:", error);
    alert(t("removeProductError"));
  }
}

function applyFilters() {
  const query = searchInput.value.toLowerCase().trim();
  const baseList = query
    ? allProducts.filter((product) =>
        product.title.toLowerCase().includes(query)
      )
    : [...allProducts];

  filteredProducts = sortProductList(baseList);
  renderProducts();
}

function sortProductList(products: TrackedProduct[]): TrackedProduct[] {
  return [...products].sort((a, b) => {
    switch (currentSortOption) {
      case "store": {
        return getStoreDisplayName(a).localeCompare(
          getStoreDisplayName(b),
          "es"
        );
      }
      case "price": {
        const priceDiff = a.currentPrice - b.currentPrice;
        if (priceDiff !== 0) return priceDiff;
        return b.addedAt - a.addedAt;
      }
      case "discount": {
        const discountDiff = getDiscountPercent(b) - getDiscountPercent(a);
        if (discountDiff !== 0) return discountDiff;
        return b.addedAt - a.addedAt;
      }
      case "date":
      default:
        return b.addedAt - a.addedAt;
    }
  });
}

function getStoreDisplayName(product: TrackedProduct): string {
  if (product.storeName) {
    return product.storeName;
  }

  try {
    return new URL(product.url).hostname.replace(/^www\./, "");
  } catch {
    return formatAdapterLabel(product.adapter);
  }
}

function getDiscountPercent(product: TrackedProduct): number {
  if (!product.initialPrice || product.initialPrice === 0) {
    return 0;
  }
  const diff =
    ((product.initialPrice - product.currentPrice) / product.initialPrice) *
    100;
  return Number.isFinite(diff) ? diff : 0;
}

// Handle search
function handleSearch() {
  applyFilters();
}

function handleSortChange() {
  currentSortOption = sortSelect.value as SortOption;
  applyFilters();
}

// Handle refresh
async function handleRefresh() {
  refreshBtn.disabled = true;
  refreshBtn.style.opacity = "0.5";

  try {
    // Send message to service worker to check prices now
    await chrome.runtime.sendMessage({ action: "checkPricesNow" });

    // Wait a bit then reload
    setTimeout(async () => {
      await loadProducts();
      refreshBtn.disabled = false;
      refreshBtn.style.opacity = "1";
    }, 2000);
  } catch (error) {
    console.error("Failed to refresh:", error);
    refreshBtn.disabled = false;
    refreshBtn.style.opacity = "1";
  }
}

function handleDarkModeToggle() {
  const appliedTheme = document.documentElement.getAttribute("data-theme");
  const nextTheme: ThemePreference = appliedTheme === "dark" ? "light" : "dark";
  currentThemePreference = nextTheme;
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
}

function handleThemePreferenceChange() {
  const selected = themePreference.value as ThemePreference;
  currentThemePreference = selected;
  localStorage.setItem(THEME_STORAGE_KEY, selected);
  applyTheme(selected);
}

function loadDarkMode() {
  const storedPreference = (localStorage.getItem(THEME_STORAGE_KEY) ||
    localStorage.getItem("theme")) as ThemePreference | null;
  currentThemePreference =
    storedPreference === "dark" || storedPreference === "system"
      ? storedPreference
      : "light";
  localStorage.setItem(THEME_STORAGE_KEY, currentThemePreference);
  localStorage.removeItem("theme");
  applyTheme(currentThemePreference);
}

function applyTheme(preference: ThemePreference) {
  const resolvedTheme =
    preference === "system"
      ? prefersDarkScheme.matches
        ? "dark"
        : "light"
      : preference;
  document.documentElement.setAttribute("data-theme", resolvedTheme);
  darkModeToggle.querySelector("span")!.textContent =
    resolvedTheme === "dark" ? "☀️" : "🌙";
  if (themePreference) {
    themePreference.value = preference;
  }
}

const handleSystemThemeChange = () => {
  if (currentThemePreference === "system") {
    applyTheme("system");
  }
};

if (typeof prefersDarkScheme.addEventListener === "function") {
  prefersDarkScheme.addEventListener("change", handleSystemThemeChange);
} else if (typeof prefersDarkScheme.addListener === "function") {
  prefersDarkScheme.addListener(handleSystemThemeChange);
}

// Setup event listeners
function setupEventListeners() {
  searchInput.addEventListener("input", handleSearch);
  sortSelect.addEventListener("change", handleSortChange);
  refreshBtn.addEventListener("click", handleRefresh);
  darkModeToggle.addEventListener("click", handleDarkModeToggle);
  settingsBtn.addEventListener("click", openSettingsModal);
  closeSettingsBtn.addEventListener("click", closeSettingsModal);
  saveSettingsBtn.addEventListener("click", saveSettings);
  testNotificationBtn.addEventListener("click", testNotification);
  testFirebaseBtn.addEventListener("click", testFirebaseConnection);
  clearRateLimitsBtn.addEventListener("click", clearRateLimits);
  themePreference.addEventListener("change", handleThemePreferenceChange);
  enableNotifications.addEventListener("change", handleNotificationToggle);
  historyExpandBtn.addEventListener("click", handleHistoryExpand);

  rangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const range = button.dataset.range as HistoryRange | undefined;
      if (range) {
        setHistoryRange(range);
      }
    });
  });

  // Threshold slider
  notificationThreshold.addEventListener("input", () => {
    thresholdValue.textContent = `${notificationThreshold.value}%`;
  });

  // Listen for storage changes (now using local storage)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      // Reload if any product key changed
      const hasProductChange = Object.keys(changes).some((key) =>
        key.startsWith("product_")
      );
      if (hasProductChange) {
        loadProducts();
      }
    }
  });

  updateRangeButtons(currentHistoryRange);
  setHistoryExpanded(false);
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
        const img = document.createElement("img");
        img.className = "product-image";

        // Set up loading promise with timeout
        const imageLoadPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Image load timeout"));
          }, 8000); // 8 second timeout

          img.onload = () => {
            clearTimeout(timeout);
            img.classList.add("fade-in");
            resolve();
          };

          img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("Image failed to load"));
          };
        });

        // Try to get image URL from backend
        const imageUrl = await Promise.race([
          getProductImageUrl(product.url),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("Backend timeout")), 5000)
          ),
        ]);

        if (imageUrl) {
          img.src = imageUrl;
          img.alt = product.title;

          // Wait for image to load
          await imageLoadPromise;

          // Replace placeholder with loaded image
          imgContainer.replaceWith(img);
        } else {
          throw new Error("No image URL available");
        }
      } catch (error) {
        console.debug(`Failed to load image for product ${product.id}:`, error);

        // Show error fallback
        const errorImg = document.createElement("div");
        errorImg.className = "product-image error";
        errorImg.innerHTML = "📦"; // Package emoji as fallback
        errorImg.title = t("imageUnavailable");

        imgContainer.replaceWith(errorImg);
      }
    });

    imagePromises.push(...batchPromises);
  }

  // Wait for all images to finish loading (but don't block UI)
  Promise.allSettled(imagePromises)
    .then((results) => {
      const loaded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      console.debug(
        `Image loading complete: ${loaded} loaded, ${failed} failed`
      );
    })
    .catch(() => {
      // Ignore errors in Promise.allSettled
    });
}

// Price History Modal Functions
async function handleShowHistory(product: TrackedProduct) {
  const modal = document.getElementById("historyModal") as HTMLDivElement;
  const modalTitle = document.getElementById(
    "modalTitle"
  ) as HTMLHeadingElement;
  const closeBtn = document.getElementById(
    "closeModalBtn"
  ) as HTMLButtonElement;

  // Set title
  modalTitle.textContent = product.title;
  setHistoryExpanded(false);
  currentHistoryRange = "30";
  updateRangeButtons(currentHistoryRange);
  activeHistoryProduct = product;

  // Show modal with loading state
  modal.style.display = "flex";

  try {
    // Fetch history from backend
    const priceHistory = await getProductHistory(product.url);
    historyDataCache = [...priceHistory].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    const historyForRange = getFilteredHistoryData(
      historyDataCache,
      currentHistoryRange
    );
    updateHistoryStats(product, historyForRange);
    renderPriceChart(product, historyForRange);
  } catch (error) {
    console.error("Failed to load price history", error);
    // Show error or fallback
    modalTitle.textContent = `${product.title} (${t("errorLoadingHistory")})`;
  }

  // Setup close handlers
  closeBtn.onclick = closeHistoryModal;
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeHistoryModal();
    }
  };

  // ESC key to close
  document.addEventListener("keydown", handleEscapeKey);
}

function closeHistoryModal() {
  const modal = document.getElementById("historyModal") as HTMLDivElement;
  modal.style.display = "none";

  // Destroy chart instance to free memory
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }

  // Remove ESC listener
  document.removeEventListener("keydown", handleEscapeKey);
  resetHistoryState();
}

function handleEscapeKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    closeHistoryModal();
  }
}

function updateHistoryStats(
  product: TrackedProduct,
  priceHistory: PriceDataPoint[]
) {
  const currentPriceEl = document.getElementById(
    "statCurrentPrice"
  ) as HTMLSpanElement;
  const initialPriceEl = document.getElementById(
    "statInitialPrice"
  ) as HTMLSpanElement;
  const lowestPriceEl = document.getElementById(
    "statLowestPrice"
  ) as HTMLSpanElement;
  const highestPriceEl = document.getElementById(
    "statHighestPrice"
  ) as HTMLSpanElement;
  const averagePriceEl = document.getElementById(
    "statAveragePrice"
  ) as HTMLSpanElement;

  const currency = product.currency === "EUR" ? "€" : product.currency;
  const formatValue = (value: number) => `${value.toFixed(2)}${currency}`;

  // Current price
  currentPriceEl.textContent = formatValue(product.currentPrice);

  // Initial price
  initialPriceEl.textContent = formatValue(product.initialPrice);

  // Calculate min/max from backend history
  if (priceHistory.length > 0) {
    const prices = priceHistory.map((h) => h.price);
    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);
    const average =
      prices.reduce((sum, value) => sum + value, 0) / prices.length;

    lowestPriceEl.textContent = formatValue(lowest);
    highestPriceEl.textContent = formatValue(highest);
    averagePriceEl.textContent = formatValue(average);
  } else {
    lowestPriceEl.textContent = formatValue(product.currentPrice);
    highestPriceEl.textContent = formatValue(product.currentPrice);
    averagePriceEl.textContent = formatValue(product.currentPrice);
  }
}

function renderPriceChart(
  product: TrackedProduct,
  priceHistory: PriceDataPoint[]
) {
  const canvas = document.getElementById("priceChart") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  // Destroy existing chart
  if (currentChart) {
    currentChart.destroy();
  }

  // Use backend history (already limited to 500 entries)
  let historyData = [...priceHistory];

  // Fallback if no history available
  if (historyData.length === 0) {
    historyData = [
      {
        price: product.currentPrice,
        currency: product.currency,
        timestamp: product.addedAt,
        source: "user" as const,
      },
    ];
  }

  // Sort by timestamp
  historyData.sort((a, b) => a.timestamp - b.timestamp);

  const labels = historyData.map((entry) =>
    new Date(entry.timestamp).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    })
  );

  const prices = historyData.map((entry) => entry.price);
  const currencyLabel = product.currency === "EUR" ? "€" : product.currency;
  const formatPrice = (value: number) => `${value.toFixed(2)}${currencyLabel}`;

  // Detect theme
  const theme = document.documentElement.getAttribute("data-theme") || "light";
  const isDark = theme === "dark";

  // Theme colors
  const textColor = isDark ? "#e2e8f0" : "#4a5568";
  const gridColor = isDark
    ? "rgba(74, 85, 104, 0.3)"
    : "rgba(226, 232, 240, 0.8)";
  const lineColor = "#3b82f6";
  const fillColor = isDark
    ? "rgba(59, 130, 246, 0.1)"
    : "rgba(59, 130, 246, 0.05)";

  // Create chart
  currentChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: t("priceLabel"),
          data: prices,
          borderColor: lineColor,
          backgroundColor: fillColor,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: lineColor,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: isDark ? "#2d3748" : "#ffffff",
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: gridColor,
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (items) => (items[0]?.label ? items[0].label : ""),
            label: (context) => {
              const price = context.parsed.y ?? 0;
              return `${t("priceLabel")}: ${formatPrice(price)}`;
            },
            afterLabel: (context) => {
              if (!product.initialPrice) {
                return "";
              }
              const price = context.parsed.y ?? 0;
              const diffPercent =
                ((price - product.initialPrice) / product.initialPrice) * 100;
              if (!Number.isFinite(diffPercent)) {
                return "";
              }
              const sign = diffPercent >= 0 ? "+" : "−";
              return `${t("vsInitial")} ${sign}${Math.abs(diffPercent).toFixed(
                1
              )}%`;
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
              const numericValue =
                typeof value === "number" ? value : Number(value);
              return formatPrice(numericValue);
            },
          },
        },
      },
      interaction: {
        intersect: false,
        mode: "index",
      },
    },
  });
}

function setHistoryRange(range: HistoryRange) {
  currentHistoryRange = range;
  updateRangeButtons(range);
  if (!activeHistoryProduct || historyDataCache.length === 0) {
    return;
  }
  const dataForRange = getFilteredHistoryData(historyDataCache, range);
  updateHistoryStats(activeHistoryProduct, dataForRange);
  renderPriceChart(activeHistoryProduct, dataForRange);
}

function updateRangeButtons(range: HistoryRange) {
  rangeButtons.forEach((button) => {
    const isActive = button.dataset.range === range;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function getFilteredHistoryData(
  data: PriceDataPoint[],
  range: HistoryRange
): PriceDataPoint[] {
  if (range === "all") {
    return [...data];
  }

  const days = parseInt(range, 10);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const filtered = data.filter((entry) => entry.timestamp >= cutoff);
  return filtered.length > 0 ? filtered : [...data];
}

function handleHistoryExpand() {
  setHistoryExpanded(!isHistoryExpanded);
}

function setHistoryExpanded(expanded: boolean) {
  if (!historyModalContent || !historyExpandBtn) {
    return;
  }

  isHistoryExpanded = expanded;
  historyModalContent.classList.toggle("expanded", expanded);
  historyExpandBtn.textContent = expanded ? "⤡" : "⤢";
  historyExpandBtn.setAttribute("aria-pressed", expanded ? "true" : "false");
  historyExpandBtn.title = expanded ? t("reduceChart") : t("expandChart");
  historyExpandBtn.setAttribute(
    "aria-label",
    expanded ? t("reduceChart") : t("expandChart")
  );

  if (currentChart) {
    currentChart.resize();
  }
}

function resetHistoryState() {
  activeHistoryProduct = null;
  historyDataCache = [];
  currentHistoryRange = "30";
  updateRangeButtons(currentHistoryRange);
  setHistoryExpanded(false);
}

// Update status indicators (Firebase and last update)
async function updateStatusIndicators() {
  setConnectionHintState("checking", t("checkingConnection"));
  settingsConnectionStatus.textContent = "⚪ " + t("checkingConnection");
  settingsConnectionStatus.className = "status-badge checking";
  settingsConnectionStatus.title = t("checkingConnection");
  settingsConnectionStatus.setAttribute("aria-label", t("checkingConnection"));
  try {
    const [anonymousUserId, lastCheckTime] = await Promise.all([
      StorageManager.getAnonymousUserId(),
      StorageManager.getLastCheckTime(),
    ]);
    const isConnected = Boolean(anonymousUserId);
    const statusLabel = isConnected
      ? "🟢 " + t("connected")
      : "🔴 " + t("disconnected");
    const statusClass = isConnected
      ? "status-badge connected"
      : "status-badge disconnected";
    const statusTitle = isConnected
      ? `Firebase UID: ${anonymousUserId!.substring(0, 8)}...`
      : t("notConnectedFirebase");

    settingsConnectionStatus.textContent = statusLabel;
    settingsConnectionStatus.className = statusClass;
    settingsConnectionStatus.title = statusTitle;
    settingsConnectionStatus.setAttribute(
      "aria-label",
      isConnected ? "Conectado" : "Desconectado"
    );

    const hintLabel = isConnected
      ? "Estado de conexión: conectado"
      : "Estado de conexión: desconectado";
    setConnectionHintState(
      isConnected ? "connected" : "disconnected",
      `${hintLabel}. ${statusTitle}`
    );

    if (lastCheckTime > 0) {
      settingsLastSync.textContent = `${t("lastSync")} ${formatTimestamp(
        lastCheckTime
      )}`;
      settingsLastSync.title = `Última actualización: ${new Date(
        lastCheckTime
      ).toLocaleString()}`;
    } else {
      settingsLastSync.textContent = t("notSyncedYet");
      settingsLastSync.title = "No se han realizado chequeos automáticos aún";
    }
  } catch (error) {
    console.error("Error updating status indicators:", error);
    settingsConnectionStatus.textContent = "⚪ " + t("error");
    settingsConnectionStatus.className = "status-badge";
    settingsConnectionStatus.title = t("connectionCheckError");
    settingsConnectionStatus.setAttribute(
      "aria-label",
      t("connectionCheckError")
    );
    settingsLastSync.textContent = "Desconocido";
    settingsLastSync.title = "No se pudo obtener la última sincronización";
    setConnectionHintState("error", t("connectionCheckError"));
  }
}

type ConnectionIndicatorState =
  | "connected"
  | "disconnected"
  | "checking"
  | "error";

function setConnectionHintState(
  state: ConnectionIndicatorState,
  label: string
) {
  if (!connectionHint) {
    return;
  }

  connectionHint.dataset.state = state;
  connectionHint.title = label;
  connectionHint.setAttribute("aria-label", label);
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
    themePreference.value = currentThemePreference;

    // Check Firebase status
    const anonymousUserId = await StorageManager.getAnonymousUserId();
    if (anonymousUserId) {
      firebaseStatusDetail.textContent = `✅ ${t(
        "connected"
      )} (UID: ${anonymousUserId.substring(0, 12)}...)`;
      firebaseStatusDetail.className = "status-detail success";
    } else {
      firebaseStatusDetail.textContent = t("notConnectedFirebase");
      firebaseStatusDetail.className = "status-detail error";
    }

    const collapsePreference = await chrome.storage.local.get(
      BUTTON_COLLAPSE_KEY
    );
    const isCompact = Boolean(collapsePreference[BUTTON_COLLAPSE_KEY]);
    floatingButtonBehavior.value = isCompact ? "compact" : "expanded";
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

// Open settings modal
function openSettingsModal() {
  settingsModal.style.display = "flex";
  loadSettings(); // Reload settings when opening
}

// Close settings modal
function closeSettingsModal() {
  settingsModal.style.display = "none";
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

    const shouldStartCompact = floatingButtonBehavior.value === "compact";
    await chrome.storage.local.set({
      [BUTTON_COLLAPSE_KEY]: shouldStartCompact,
    });

    // Update alarm with new interval
    await chrome.runtime.sendMessage({
      action: "updateAlarm",
      intervalHours: newInterval,
    });

    // Show success feedback
    saveSettingsBtn.textContent = t("saved");
    setTimeout(() => {
      saveSettingsBtn.textContent = t("saveSettings");
      closeSettingsModal();
    }, 1500);

    // Reload status indicators
    await updateStatusIndicators();
  } catch (error) {
    console.error("Error saving settings:", error);
    saveSettingsBtn.textContent = "❌ " + t("error");
    setTimeout(() => {
      saveSettingsBtn.textContent = t("saveSettings");
    }, 2000);
  }
}

// Test notification
async function testNotification() {
  try {
    testNotificationBtn.disabled = true;
    testNotificationBtn.textContent = t("sending");

    await chrome.notifications.create("test-notification", {
      type: "basic",
      iconUrl: chrome.runtime.getURL("popup/icons/icon128.svg"),
      title: t("testNotificationTitle"),
      message: t("notificationsWorking"),
      priority: 2,
    });

    testNotificationBtn.textContent = t("sent");
    setTimeout(() => {
      testNotificationBtn.textContent = t("testNotificationButton");
      testNotificationBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error("Error testing notification:", error);
    testNotificationBtn.textContent = "❌ " + t("error");
    setTimeout(() => {
      testNotificationBtn.textContent = t("testNotificationButton");
      testNotificationBtn.disabled = false;
    }, 2000);
  }
}

// Test Firebase connection
async function testFirebaseConnection() {
  try {
    testFirebaseBtn.disabled = true;
    testFirebaseBtn.textContent = t("testing");
    firebaseStatusDetail.textContent = t("checkingConnection");
    firebaseStatusDetail.className = "status-detail";

    // Try to get anonymous user ID (this will authenticate if needed)
    const anonymousUserId = await StorageManager.getAnonymousUserId();

    if (anonymousUserId) {
      firebaseStatusDetail.textContent = `${t(
        "connectedSuccessfully"
      )} (UID: ${anonymousUserId.substring(0, 12)}...)`;
      firebaseStatusDetail.className = "status-detail success";
      testFirebaseBtn.textContent = "✅ " + t("connected");
    } else {
      firebaseStatusDetail.textContent = t("notConfiguredFirebase");
      firebaseStatusDetail.className = "status-detail error";
      testFirebaseBtn.textContent = "❌ " + t("error");
    }

    setTimeout(() => {
      testFirebaseBtn.textContent = t("testFirebaseConnection");
      testFirebaseBtn.disabled = false;
    }, 2000);

    // Update header status
    await updateStatusIndicators();
  } catch (error) {
    console.error("Error testing Firebase:", error);
    firebaseStatusDetail.textContent = `❌ ${t("error")}: ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
    firebaseStatusDetail.className = "status-detail error";
    testFirebaseBtn.textContent = "❌ " + t("error");
    setTimeout(() => {
      testFirebaseBtn.textContent = t("testFirebaseConnection");
      testFirebaseBtn.disabled = false;
    }, 2000);
  }
}

// Clear rate limits
async function clearRateLimits() {
  try {
    clearRateLimitsBtn.disabled = true;
    clearRateLimitsBtn.textContent = t("retrying");

    await chrome.runtime.sendMessage({ action: "clearAllRateLimits" });

    clearRateLimitsBtn.textContent = t("retried");
    setTimeout(() => {
      clearRateLimitsBtn.textContent = t("retryBlockedProducts");
      clearRateLimitsBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error("Error clearing rate limits:", error);
    clearRateLimitsBtn.textContent = "❌ " + t("error");
    setTimeout(() => {
      clearRateLimitsBtn.textContent = t("retryBlockedProducts");
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
  thresholdValue.classList.toggle("disabled", !notificationsEnabled);
}

// Initialize on load
init();

// Notify service worker when popup closes
window.addEventListener("beforeunload", () => {
  chrome.runtime.sendMessage({ action: "popupClosed" }).catch(() => {
    // Ignore errors if service worker is not available
  });
});

// Notify service worker when popup opens
chrome.runtime.sendMessage({ action: "popupOpened" }).catch(() => {
  // Ignore errors if service worker is not available
});
