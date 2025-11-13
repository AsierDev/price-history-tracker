/**
 * Content script - injects the Track Price button and decides support mode per page
 */

import type { ExtractedProductData } from './core/types';
import type { ExtractedMetadata } from './utils/metadataExtractor';
import { getAdapterForUrl, getBadgeInfo } from './adapters/registry';
import { PricePicker } from './content-script/pricePicker';
import { resolveSupportMode, type SupportMode } from './content-script/supportMode';
import { logger } from './utils/logger';
import { extractMetadata } from './utils/metadataExtractor';

type ButtonState = 'idle' | 'extracting' | 'selecting' | 'added' | 'error';

type MetadataPayload = {
  title: string;
  imageUrl?: string;
  storeName: string;
};

type ContentScriptMessage =
  | {
      action: 'trackProduct';
      url: string;
      productData: ExtractedProductData;
      metadata: MetadataPayload;
      supportMode: SupportMode;
    }
  | {
      action: 'trackProductManual';
      url: string;
      priceElement: { selector: string; text: string };
      metadata: MetadataPayload;
    }
  | { action: 'ping' };

type MessageResponse = { success: boolean; error?: string; pong?: boolean };

const PRIMARY_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const SUCCESS_GRADIENT = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
const ERROR_GRADIENT = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';

const pricePicker = new PricePicker();
const BUTTON_COLLAPSE_KEY = 'phtButtonCollapsed';

let trackButton: HTMLButtonElement | null = null;
let buttonLabelEl: HTMLSpanElement | null = null;
let buttonBadgeEl: HTMLSpanElement | null = null;
let buttonWrapper: HTMLDivElement | null = null;
let collapseToggleEl: HTMLButtonElement | null = null;
let collapsedFabEl: HTMLButtonElement | null = null;
let currentMode: SupportMode = 'none';
let lastUrl = window.location.href;
let isButtonCollapsed = false;

/**
 * Entry point
 */
async function initContentScript() {
  await loadButtonPreferences();
  evaluateSupportMode(true);
  observeSpaNavigation();
  sendPingToServiceWorker();

  logger.debug('Content script initialized', {
    url: window.location.href,
    mode: currentMode,
  });
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      void initContentScript();
    },
    { once: true },
  );
} else {
  void initContentScript();
}

function evaluateSupportMode(force = false) {
  const url = window.location.href;
  const nextMode = resolveSupportMode(url, document);

  logger.info('Support mode evaluation', {
    url,
    nextMode,
    previousMode: currentMode,
  });

  if (!force && nextMode === currentMode) {
    updateButtonBadge();
    return;
  }

  currentMode = nextMode;

  if (currentMode === 'none') {
    removeTrackButton();
    return;
  }

  ensureTrackButton();
  setButtonState('idle');
  updateButtonBadge();
}

/**
 * Create button if needed
 */
function ensureTrackButton() {
  if (trackButton) {
    return;
  }

  buttonWrapper = document.createElement('div');
  buttonWrapper.id = 'price-tracker-wrapper';
  buttonWrapper.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    z-index: 2147483645;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;

  trackButton = document.createElement('button');
  trackButton.id = 'price-tracker-btn';
  trackButton.type = 'button';
  trackButton.style.cssText = `
    padding: 14px 20px;
    background: ${PRIMARY_GRADIENT};
    color: #fff;
    border: none;
    border-radius: 28px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
    transition: all 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 220px;
    position: relative;
  `;

  buttonLabelEl = document.createElement('span');
  buttonLabelEl.className = 'pht-label';
  buttonLabelEl.textContent = labelForCurrentMode();

  buttonBadgeEl = document.createElement('span');
  buttonBadgeEl.className = 'pht-badge';
  buttonBadgeEl.style.cssText = `
    background: rgba(255, 255, 255, 0.15);
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.3px;
  `;

  trackButton.addEventListener('mouseenter', () => {
    if (trackButton) {
      trackButton.style.transform = 'translateY(-2px)';
      trackButton.style.boxShadow = '0 10px 22px rgba(0, 0, 0, 0.25)';
    }
  });

  trackButton.addEventListener('mouseleave', () => {
    if (trackButton) {
      trackButton.style.transform = 'translateY(0)';
      trackButton.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.2)';
    }
  });

  trackButton.addEventListener('click', () => {
    if (isButtonCollapsed) {
      void setButtonCollapsedState(false);
      return;
    }
    void handleTrackPrice();
  });

  collapseToggleEl = document.createElement('button');
  collapseToggleEl.type = 'button';
  collapseToggleEl.title = 'Ocultar botón';
  collapseToggleEl.textContent = '–';
  collapseToggleEl.style.cssText = `
    position: absolute;
    top: -12px;
    right: -12px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;
  collapseToggleEl.addEventListener('click', event => {
    event.stopPropagation();
    void setButtonCollapsedState(true);
  });

  collapsedFabEl = document.createElement('button');
  collapsedFabEl.type = 'button';
  collapsedFabEl.title = 'Mostrar Price Tracker';
  collapsedFabEl.textContent = '📈';
  collapsedFabEl.style.cssText = `
    width: 52px;
    height: 52px;
    border-radius: 26px;
    border: none;
    background: ${PRIMARY_GRADIENT};
    color: #fff;
    font-size: 24px;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
    display: none;
    align-items: center;
    justify-content: center;
  `;
  collapsedFabEl.addEventListener('click', () => {
    void setButtonCollapsedState(false);
  });

  trackButton.appendChild(buttonLabelEl);
  trackButton.appendChild(buttonBadgeEl);
  trackButton.appendChild(collapseToggleEl);
  buttonWrapper.appendChild(trackButton);
  buttonWrapper.appendChild(collapsedFabEl);
  document.body.appendChild(buttonWrapper);
  updateCollapsedPresentation();
}

function removeTrackButton() {
  if (buttonWrapper) {
    buttonWrapper.remove();
  }
  buttonWrapper = null;
  trackButton = null;
  buttonLabelEl = null;
  buttonBadgeEl = null;
  collapseToggleEl = null;
  collapsedFabEl = null;
}

function updateButtonBadge() {
  if (!trackButton || !buttonBadgeEl) return;

  if (currentMode === 'manual') {
    buttonBadgeEl.textContent = '📍 Manual';
  } else {
    const badgeInfo = getBadgeInfo(window.location.href);
    buttonBadgeEl.textContent = `${badgeInfo.emoji} ${badgeInfo.text}`;
  }

  trackButton.dataset.mode = currentMode;
}

function labelForCurrentMode(): string {
  if (currentMode === 'manual') {
    return 'Seleccionar precio';
  }
  if (currentMode === 'whitelist') {
    return 'Auto (whitelist)';
  }
  if (currentMode === 'specific') {
    return 'Auto (tienda)';
  }
  return 'Seguir precio';
}

function setButtonState(state: ButtonState, message?: string) {
  if (!trackButton || !buttonLabelEl) return;

  switch (state) {
    case 'idle':
      trackButton.disabled = false;
      trackButton.style.opacity = '1';
      trackButton.style.background = PRIMARY_GRADIENT;
      buttonLabelEl.textContent = labelForCurrentMode();
      break;
    case 'extracting':
      trackButton.disabled = true;
      trackButton.style.opacity = '0.85';
      buttonLabelEl.textContent = message ?? 'Extrayendo precio...';
      break;
    case 'selecting':
      trackButton.disabled = true;
      trackButton.style.opacity = '0.85';
      buttonLabelEl.textContent = message ?? 'Haz clic sobre el precio…';
      break;
    case 'added':
      trackButton.disabled = true;
      trackButton.style.background = SUCCESS_GRADIENT;
      buttonLabelEl.textContent = message ?? 'Producto añadido ✅';
      setTimeout(() => setButtonState('idle'), 2000);
      break;
    case 'error':
      trackButton.disabled = true;
      trackButton.style.background = ERROR_GRADIENT;
      buttonLabelEl.textContent = message ?? 'No se pudo añadir';
      setTimeout(() => setButtonState('idle'), 2500);
      break;
  }
}

/**
 * Handle button click according to support mode
 */
async function handleTrackPrice() {
  if (currentMode === 'none') {
    logger.warn('Track button clicked but mode is none');
    return;
  }

  try {
    if (currentMode === 'manual') {
      await handleManualTracking();
      return;
    }

    await handleAutomaticTracking();
  } catch (error) {
    logger.error('Failed to track product', error);
    setButtonState('error', error instanceof Error ? error.message : 'Error desconocido');
  }
}

/**
 * Automatic extraction flow
 */
async function handleAutomaticTracking() {
  setButtonState('extracting', 'Extrayendo datos…');

  const adapter = getAdapterForUrl(window.location.href);

  if (!adapter) {
    logger.warn('No adapter resolved during automatic tracking');
    setButtonState('error', 'Sitio no soportado');
    return;
  }

  if (adapter.requiresManualSelection) {
    logger.info('Adapter requires manual selection; switching flow');
    currentMode = 'manual';
    updateButtonBadge();
    await handleManualTracking();
    return;
  }

  let productData: ExtractedProductData;
  try {
    productData = await adapter.extractData(document.documentElement.outerHTML);
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTO_EXTRACT_FAILED') {
      logger.warn('Auto extraction failed, falling back to manual selector');
      currentMode = 'manual';
      updateButtonBadge();
      await handleManualTracking();
      return;
    }
    throw error;
  }

  if (!productData.available) {
    logger.warn('Adapter reported product unavailable', { url: window.location.href });
    setButtonState('error', productData.error ?? 'Producto no disponible');
    return;
  }

  const metadata = buildMetadataPayload();

  const response = await sendMessageWithRetry({
    action: 'trackProduct',
    url: window.location.href,
    productData,
    metadata,
    supportMode: currentMode,
  });

  if (response.success) {
    setButtonState('added', 'Producto añadido ✅');
  } else {
    setButtonState('error', response.error ?? 'No se pudo añadir');
  }
}

/**
 * Manual selector flow
 */
async function handleManualTracking(): Promise<void> {
  setButtonState('selecting');

  const result = await pricePicker.activate();

  if (!result || !result.success) {
    logger.info('Manual selection cancelled');
    setButtonState('idle');
    return;
  }

  setButtonState('extracting', 'Procesando selección…');

  const metadata = buildMetadataPayload();

  const response = await sendMessageWithRetry({
    action: 'trackProductManual',
    url: window.location.href,
    priceElement: {
      selector: result.selector,
      text: result.text,
    },
    metadata,
  });

  if (response.success) {
    setButtonState('added', 'Producto añadido ✅');
  } else {
    setButtonState('error', response.error ?? 'No se pudo añadir');
  }
}

function buildMetadataPayload(): MetadataPayload {
  const metadata: ExtractedMetadata = extractMetadata(document, window.location.href);
  return {
    title: metadata.title,
    imageUrl: metadata.imageUrl,
    storeName: metadata.storeName,
  };
}

/**
 * Message helper with retry logic to wake the service worker
 */
async function sendMessageWithRetry(message: ContentScriptMessage, maxRetries = 3): Promise<MessageResponse> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Message attempt ${attempt} failed`, { error: errorMessage, action: message.action });

      if (!errorMessage.includes('Extension context invalidated') || attempt === maxRetries) {
        throw error;
      }

      try {
        await chrome.runtime.sendMessage({ action: 'ping' });
      } catch {
        // Ignore ping errors
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Failed to reach service worker');
}

/**
 * SPA navigation watcher
 */
function observeSpaNavigation() {
  const observer = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      setTimeout(() => evaluateSupportMode(true), 150);
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

/**
 * Allow popup to trigger manual selector
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'enablePricePicker') {
    evaluateSupportMode(true);
    handleManualTracking()
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        logger.error('Manual tracking triggered via message failed', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      });
    return true;
  }

  if (message.action === 'detectEcommerce') {
    const mode = resolveSupportMode(window.location.href, document);
    sendResponse({
      isEcommerce: mode !== 'none',
      mode,
    });
    return true;
  }

  return false;
});

/**
 * Wake the service worker on load
 */
async function sendPingToServiceWorker() {
  try {
    await chrome.runtime.sendMessage({ action: 'ping' });
  } catch (error) {
    logger.warn('Failed to send initial ping to service worker', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function loadButtonPreferences(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(BUTTON_COLLAPSE_KEY);
    isButtonCollapsed = Boolean(stored[BUTTON_COLLAPSE_KEY]);
  } catch (error) {
    isButtonCollapsed = false;
    logger.warn('Unable to read button preference', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function setButtonCollapsedState(collapsed: boolean): Promise<void> {
  if (isButtonCollapsed === collapsed) {
    updateCollapsedPresentation();
    return;
  }

  isButtonCollapsed = collapsed;

  try {
    await chrome.storage.local.set({ [BUTTON_COLLAPSE_KEY]: collapsed });
  } catch (error) {
    logger.warn('Unable to persist button preference', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  updateCollapsedPresentation();
}

function updateCollapsedPresentation() {
  if (!trackButton || !collapseToggleEl || !collapsedFabEl) {
    return;
  }

  if (isButtonCollapsed) {
    trackButton.style.display = 'none';
    collapseToggleEl.style.display = 'none';
    collapsedFabEl.style.display = 'flex';
  } else {
    trackButton.style.display = 'flex';
    collapseToggleEl.style.display = 'flex';
    collapsedFabEl.style.display = 'none';
  }
}
