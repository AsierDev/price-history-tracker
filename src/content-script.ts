/**
 * Content script - Injects "Track Price" button on product pages
 */

import type { ExtractedProductData } from './core/types';
import { logger } from './utils/logger';
import { getAdapterForUrl, isUrlSupported } from './adapters/registry';

// Types for messages sent from content script
type ContentScriptMessage =
  | { action: 'ping' }
  | { action: 'trackProduct'; url: string; productData: ExtractedProductData };

type MessageResponse = { success: boolean; error?: string; pong?: boolean };

/**
 * Send message to service worker with retry logic for "Extension context invalidated"
 */
async function sendMessageWithRetry(message: ContentScriptMessage, maxRetries = 3): Promise<MessageResponse> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`Sending message (attempt ${attempt}/${maxRetries})`, { action: message.action });

      // Try to send the message
      const response = await chrome.runtime.sendMessage(message);
      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Message attempt ${attempt} failed`, { error: errorMessage, action: message.action });

      // If it's "Extension context invalidated", try to wake up service worker
      if (errorMessage.includes('Extension context invalidated')) {
        if (attempt < maxRetries) {
          // Try to wake up the service worker by sending a simple ping
          try {
            await chrome.runtime.sendMessage({ action: 'ping' });
          } catch (pingError) {
            // Ignore ping errors, just wait
          }

          // Wait before retrying (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          logger.debug(`Waiting ${delay}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      // If it's not "Extension context invalidated" or we've exhausted retries, throw
      throw error;
    }
  }

  throw new Error('Failed to send message after all retries');
}

// Check if we're on a supported product page
const currentUrl = window.location.href;
const isSupported = isUrlSupported(currentUrl);

if (isSupported) {
  logger.info('Supported product page detected', { url: currentUrl });
  injectTrackButton();
}

/**
 * Inject the "Track Price" button into the page
 */
function injectTrackButton() {
  // Avoid duplicate buttons
  if (document.getElementById('price-tracker-btn')) {
    return;
  }

  // Create button
  const button = document.createElement('button');
  button.id = 'price-tracker-btn';
  button.innerHTML = '💰 Track Price';
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    padding: 12px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 24px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Hover effects
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  });

  // Click handler
  button.addEventListener('click', handleTrackPrice);

  // Inject into page
  document.body.appendChild(button);
  logger.debug('Track button injected');
}

/**
 * Handle "Track Price" button click
 */
async function handleTrackPrice() {
  const button = document.getElementById('price-tracker-btn') as HTMLButtonElement | null;
  if (!button) return;

  const resetButton = () => {
    button.textContent = '💰 Track Price';
    button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    button.disabled = false;
    button.style.opacity = '1';
  };

  const showError = (message: string) => {
    button.textContent = '❌ Failed';
    button.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    setTimeout(() => {
      resetButton();
    }, 2000);
    if (message) {
      alert(`Failed to track product: ${message}`);
    }
  };

  try {
    button.textContent = '⏳ Adding...';
    button.disabled = true;
    button.style.opacity = '0.7';

    const adapter = getAdapterForUrl(window.location.href);
    if (!adapter) {
      logger.warn('No adapter available for current URL', { url: window.location.href });
      showError('Unsupported website');
      return;
    }

    const productData = await adapter.extractData(document.documentElement.outerHTML);
    if (!productData.available) {
      logger.warn('Product not available during extraction', {
        url: window.location.href,
        error: productData.error,
      });
      showError(productData.error ?? 'Product not available');
      return;
    }

    // Send message to service worker with retry logic for "Extension context invalidated"
    const response = await sendMessageWithRetry({
      action: 'trackProduct',
      url: window.location.href,
      productData,
    });

    if (response.success) {
      button.textContent = '✅ Tracked!';
      button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

      setTimeout(() => {
        resetButton();
      }, 2000);
    } else {
      showError(response.error ?? 'Unknown error');
    }
  } catch (error) {
    logger.error('Failed to track product', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Provide user-friendly error messages for common issues
    let userMessage = errorMessage;
    if (errorMessage.includes('Extension context invalidated')) {
      userMessage = 'Extension temporarily unavailable. Please try again in a moment.';
    } else if (errorMessage.includes('Maximum')) {
      userMessage = 'Maximum number of tracked products reached. Please remove some products first.';
    }

    showError(userMessage);
  }
}

// Listen for URL changes (SPA navigation)
let lastUrl = window.location.href;
new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    
    // Remove old button
    const oldButton = document.getElementById('price-tracker-btn');
    if (oldButton) {
      oldButton.remove();
    }

    // Check if new URL is supported
    if (isUrlSupported(currentUrl)) {
      setTimeout(() => injectTrackButton(), 1000);
    }
  }
}).observe(document.body, { childList: true, subtree: true });

// Send initial ping to wake up service worker
async function sendPingToServiceWorker() {
  try {
    await chrome.runtime.sendMessage({ action: 'ping' });
  } catch (error) {
    logger.warn('Failed to send initial ping to service worker', { error: error instanceof Error ? error.message : String(error) });
  }
}

// Initialize content script
sendPingToServiceWorker();
