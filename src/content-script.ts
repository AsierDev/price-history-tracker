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
const BUTTON_LABEL_HINT_KEY = 'phtButtonLabelHintShown';
const BUTTON_STYLE_ID = 'price-tracker-styles';

let trackButton: HTMLButtonElement | null = null;
let buttonLabelContainer: HTMLSpanElement | null = null;
let buttonLabelEl: HTMLSpanElement | null = null;
let buttonBadgeEl: HTMLSpanElement | null = null;
let buttonIconEl: HTMLSpanElement | null = null;
let buttonTooltipEl: HTMLDivElement | null = null;
let buttonWrapper: HTMLDivElement | null = null;
let collapseToggleEl: HTMLButtonElement | null = null;
let collapsedFabEl: HTMLButtonElement | null = null;
let currentMode: SupportMode = 'none';
let lastUrl = window.location.href;
let isButtonCollapsed = false;
let hasShownLabelHint = false;
let labelHintTimeout: number | null = null;
let labelHintActive = false;
let forcedLabelActive = false;
let currentButtonState: ButtonState = 'idle';

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
    updateButtonPresentation();
    return;
  }

  currentMode = nextMode;

  if (currentMode === 'none') {
    removeTrackButton();
    return;
  }

  ensureTrackButton();
  setButtonState('idle');
  updateButtonPresentation();
}

/**
 * Create button if needed
 */
function ensureTrackButton() {
  if (trackButton) {
    return;
  }

  injectFloatingButtonStyles();

  buttonWrapper = document.createElement('div');
  buttonWrapper.id = 'price-tracker-wrapper';
  buttonWrapper.dataset.collapsed = 'false';

  trackButton = document.createElement('button');
  trackButton.id = 'price-tracker-btn';
  trackButton.type = 'button';
  trackButton.dataset.labelState = 'none';

  buttonIconEl = document.createElement('span');
  buttonIconEl.className = 'pht-icon';
  buttonIconEl.textContent = iconForCurrentMode();

  buttonLabelContainer = document.createElement('span');
  buttonLabelContainer.className = 'pht-label';

  buttonLabelEl = document.createElement('span');
  buttonLabelEl.className = 'pht-label-text';
  buttonLabelEl.textContent = labelForCurrentMode();

  buttonBadgeEl = document.createElement('span');
  buttonBadgeEl.className = 'pht-badge';

  buttonLabelContainer.appendChild(buttonLabelEl);
  buttonLabelContainer.appendChild(buttonBadgeEl);

  trackButton.appendChild(buttonIconEl);
  trackButton.appendChild(buttonLabelContainer);

  trackButton.addEventListener('click', () => {
    if (isButtonCollapsed) {
      void setButtonCollapsedState(false);
      return;
    }
    void handleTrackPrice();
  });

  trackButton.addEventListener('mouseenter', showTooltip);
  trackButton.addEventListener('mouseleave', hideTooltip);
  trackButton.addEventListener('focus', showTooltip);
  trackButton.addEventListener('blur', hideTooltip);
  trackButton.addEventListener(
    'touchstart',
    () => {
      showTooltip();
      window.setTimeout(() => hideTooltip(), 1600);
    },
    { passive: true },
  );

  collapseToggleEl = document.createElement('button');
  collapseToggleEl.id = 'price-tracker-hide';
  collapseToggleEl.type = 'button';
  collapseToggleEl.title = 'Ocultar botón flotante';
  collapseToggleEl.setAttribute('aria-label', 'Ocultar botón flotante');
  collapseToggleEl.textContent = 'Ocultar';
  collapseToggleEl.addEventListener('click', event => {
    event.stopPropagation();
    void setButtonCollapsedState(true);
  });

  collapsedFabEl = document.createElement('button');
  collapsedFabEl.id = 'price-tracker-collapsed';
  collapsedFabEl.type = 'button';
  collapsedFabEl.title = 'Mostrar control de precios';
  collapsedFabEl.setAttribute('aria-label', 'Mostrar control de precios');
  collapsedFabEl.textContent = '📈';
  collapsedFabEl.addEventListener('click', () => {
    void setButtonCollapsedState(false);
  });

  buttonTooltipEl = document.createElement('div');
  buttonTooltipEl.id = 'price-tracker-tooltip';
  buttonTooltipEl.setAttribute('role', 'tooltip');
  buttonTooltipEl.dataset.visible = 'false';
  trackButton.setAttribute('aria-describedby', buttonTooltipEl.id);

  buttonWrapper.appendChild(trackButton);
  buttonWrapper.appendChild(collapseToggleEl);
  buttonWrapper.appendChild(collapsedFabEl);
  buttonWrapper.appendChild(buttonTooltipEl);
  document.body.appendChild(buttonWrapper);

  updateButtonPresentation();
  updateCollapsedPresentation();
  if (!hasShownLabelHint && !isButtonCollapsed) {
    maybeShowIntroLabel();
  }
}

function removeTrackButton() {
  if (buttonWrapper) {
    buttonWrapper.remove();
  }
  buttonWrapper = null;
  trackButton = null;
  buttonLabelContainer = null;
  buttonLabelEl = null;
  buttonBadgeEl = null;
  buttonIconEl = null;
  buttonTooltipEl = null;
  collapseToggleEl = null;
  collapsedFabEl = null;
  forcedLabelActive = false;
  labelHintActive = false;
  currentButtonState = 'idle';
  if (labelHintTimeout) {
    window.clearTimeout(labelHintTimeout);
    labelHintTimeout = null;
  }
}

function updateButtonPresentation() {
  if (!trackButton) return;

  if (buttonBadgeEl) {
    if (currentMode === 'manual') {
      buttonBadgeEl.textContent = 'Modo manual';
      buttonBadgeEl.dataset.tone = 'warning';
    } else {
      const badgeInfo = getBadgeInfo(window.location.href);
      buttonBadgeEl.textContent = `${badgeInfo.emoji} ${badgeInfo.text}`;
      buttonBadgeEl.dataset.tone = badgeInfo.tone;
    }

    const hasText = Boolean(buttonBadgeEl.textContent?.trim());
    buttonBadgeEl.style.display = hasText ? 'inline-flex' : 'none';
  }

  if (buttonLabelEl && currentButtonState === 'idle') {
    buttonLabelEl.textContent = labelForCurrentMode();
  }

  if (buttonIconEl && currentButtonState === 'idle') {
    buttonIconEl.textContent = iconForCurrentMode();
  }

  trackButton.dataset.mode = currentMode;
  updateButtonAccessibility();
}

function labelForCurrentMode(): string {
  if (currentMode === 'manual') {
    return 'Seleccionar precio';
  }
  return 'Trackear precio';
}

function iconForCurrentMode(): string {
  if (currentMode === 'manual') {
    return '🖱️';
  }
  return '📈';
}

function tooltipTextForCurrentMode(): string {
  if (currentMode === 'manual') {
    return 'Seleccionar el precio en la página';
  }
  return 'Trackear el precio de este producto';
}

function setButtonState(state: ButtonState, message?: string) {
  if (!trackButton || !buttonLabelEl || !buttonIconEl) return;

  currentButtonState = state;

  if (state === 'idle') {
    trackButton.disabled = false;
    trackButton.style.opacity = '1';
    trackButton.style.background = PRIMARY_GRADIENT;
    forcedLabelActive = false;
    if (!labelHintActive) {
      setLabelState('none');
    }
    buttonIconEl.textContent = iconForCurrentMode();
    buttonLabelEl.textContent = labelForCurrentMode();
    updateButtonPresentation();
    return;
  }

  forcedLabelActive = true;
  setLabelState('state');
  trackButton.disabled = true;
  trackButton.style.opacity = '0.9';

  switch (state) {
    case 'extracting':
      trackButton.style.background = PRIMARY_GRADIENT;
      buttonIconEl.textContent = '⏳';
      buttonLabelEl.textContent = message ?? 'Extrayendo precio...';
      break;
    case 'selecting':
      trackButton.style.background = PRIMARY_GRADIENT;
      buttonIconEl.textContent = '🖱️';
      buttonLabelEl.textContent = message ?? 'Haz clic sobre el precio…';
      break;
    case 'added':
      trackButton.style.background = SUCCESS_GRADIENT;
      buttonIconEl.textContent = '✅';
      buttonLabelEl.textContent = message ?? 'Producto añadido ✅';
      window.setTimeout(() => setButtonState('idle'), 2000);
      break;
    case 'error':
      trackButton.style.background = ERROR_GRADIENT;
      buttonIconEl.textContent = '⚠️';
      buttonLabelEl.textContent = message ?? 'No se pudo añadir';
      window.setTimeout(() => setButtonState('idle'), 2500);
      break;
  }
}

type LabelState = 'none' | 'hint' | 'state';

function setLabelState(state: LabelState) {
  if (!trackButton) return;
  trackButton.dataset.labelState = state;
}

function maybeShowIntroLabel() {
  if (!trackButton || labelHintActive || hasShownLabelHint) {
    return;
  }

  labelHintActive = true;
  setLabelState('hint');
  if (labelHintTimeout) {
    window.clearTimeout(labelHintTimeout);
  }
  labelHintTimeout = window.setTimeout(() => {
    labelHintActive = false;
    if (!forcedLabelActive) {
      setLabelState('none');
    }
  }, 3500);

  if (!hasShownLabelHint) {
    hasShownLabelHint = true;
    void chrome.storage.local.set({ [BUTTON_LABEL_HINT_KEY]: true }).catch(() => {
      // Ignore preference errors
    });
  }
}

function updateButtonAccessibility() {
  if (!trackButton) return;
  const tooltip = tooltipTextForCurrentMode();
  trackButton.setAttribute('aria-label', tooltip);
  trackButton.title = tooltip;
  if (buttonTooltipEl) {
    buttonTooltipEl.textContent = tooltip;
    trackButton.setAttribute('aria-describedby', buttonTooltipEl.id);
  }
}

function showTooltip() {
  if (!buttonTooltipEl || isButtonCollapsed) return;
  buttonTooltipEl.dataset.visible = 'true';
}

function hideTooltip() {
  if (!buttonTooltipEl) return;
  buttonTooltipEl.dataset.visible = 'false';
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
    updateButtonPresentation();
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
      updateButtonPresentation();
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
    const stored = await chrome.storage.local.get([BUTTON_COLLAPSE_KEY, BUTTON_LABEL_HINT_KEY]);
    isButtonCollapsed = Boolean(stored[BUTTON_COLLAPSE_KEY]);
    hasShownLabelHint = Boolean(stored[BUTTON_LABEL_HINT_KEY]);
  } catch (error) {
    isButtonCollapsed = false;
    hasShownLabelHint = false;
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
  if (!buttonWrapper) {
    return;
  }

  buttonWrapper.dataset.collapsed = String(isButtonCollapsed);
  if (isButtonCollapsed) {
    hideTooltip();
  }
}

function injectFloatingButtonStyles() {
  if (document.getElementById(BUTTON_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = BUTTON_STYLE_ID;
  style.textContent = `
    #price-tracker-wrapper {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 2147483645;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: calc(100vw - 32px);
    }
    #price-tracker-wrapper > * {
      pointer-events: auto;
    }
    #price-tracker-btn {
      background: ${PRIMARY_GRADIENT};
      color: #fff;
      border: none;
      border-radius: 999px;
      padding: 14px 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 52px;
      min-width: 52px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 10px 22px rgba(15, 23, 42, 0.2);
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    #price-tracker-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 28px rgba(15, 23, 42, 0.25);
    }
    #price-tracker-btn:focus-visible,
    #price-tracker-hide:focus-visible,
    #price-tracker-collapsed:focus-visible {
      outline: 3px solid rgba(255, 255, 255, 0.9);
      outline-offset: 2px;
    }
    #price-tracker-btn .pht-icon {
      font-size: 20px;
      line-height: 1;
    }
    #price-tracker-btn .pht-label {
      overflow: hidden;
      max-width: 0;
      opacity: 0;
      margin-left: 0;
      display: inline-flex;
      flex-direction: column;
      gap: 4px;
      transition: max-width 0.25s ease, opacity 0.25s ease, margin-left 0.25s ease;
      white-space: nowrap;
    }
    #price-tracker-btn[data-label-state="state"] .pht-label,
    #price-tracker-btn[data-label-state="hint"] .pht-label,
    #price-tracker-btn:hover .pht-label,
    #price-tracker-btn:focus-visible .pht-label {
      max-width: 220px;
      opacity: 1;
      margin-left: 8px;
    }
    #price-tracker-btn .pht-badge {
      background: rgba(255, 255, 255, 0.18);
      border-radius: 999px;
      padding: 2px 10px;
      font-size: 11px;
      font-weight: 500;
      align-self: flex-start;
      color: #f8fafc;
    }
    #price-tracker-btn .pht-badge[data-tone="success"] {
      background: rgba(16, 185, 129, 0.25);
    }
    #price-tracker-btn .pht-badge[data-tone="info"] {
      background: rgba(59, 130, 246, 0.25);
    }
    #price-tracker-btn .pht-badge[data-tone="warning"] {
      background: rgba(245, 158, 11, 0.3);
    }
    #price-tracker-hide {
      background: rgba(15, 23, 42, 0.75);
      color: #fff;
      border: none;
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25);
      cursor: pointer;
      transition: background 0.2s ease, transform 0.2s ease;
    }
    #price-tracker-hide:hover {
      background: rgba(15, 23, 42, 0.92);
      transform: translateY(-1px);
    }
    #price-tracker-collapsed {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: none;
      background: ${PRIMARY_GRADIENT};
      color: #fff;
      font-size: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.25);
      cursor: pointer;
    }
    #price-tracker-wrapper[data-collapsed="false"] #price-tracker-collapsed {
      display: none;
    }
    #price-tracker-tooltip {
      position: absolute;
      bottom: 68px;
      left: 0;
      background: rgba(17, 24, 39, 0.95);
      color: #fff;
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 13px;
      max-width: 240px;
      line-height: 1.3;
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.35);
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.2s ease, transform 0.2s ease;
      pointer-events: none;
    }
    #price-tracker-tooltip[data-visible="true"] {
      opacity: 1;
      transform: translateY(0);
    }
    #price-tracker-wrapper[data-collapsed="true"] #price-tracker-btn,
    #price-tracker-wrapper[data-collapsed="true"] #price-tracker-hide {
      display: none;
    }
    #price-tracker-wrapper[data-collapsed="true"] #price-tracker-tooltip {
      display: none;
    }
    @media (max-width: 768px) {
      #price-tracker-wrapper {
        bottom: 16px;
        left: 16px;
      }
    }
  `;

  const target = document.head || document.documentElement;
  target.appendChild(style);
}
