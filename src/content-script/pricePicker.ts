/**
 * Price Picker - Visual price element selector
 * Allows user to manually select price element on unsupported websites
 */

import { logger } from '../utils/logger';
import { looksLikePrice } from '../utils/priceParser';

export interface PricePickerResult {
  selector: string;
  text: string;
  success: boolean;
}

export class PricePicker {
  private isActive = false;
  private overlay: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;
  private highlightedElement: HTMLElement | null = null;
  private resolveCallback: ((result: PricePickerResult | null) => void) | null = null;

  // Bound event handlers (for proper removal)
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundClick: ((e: MouseEvent) => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Activate price picker mode
   * Returns promise that resolves when user selects an element or cancels
   */
  activate(): Promise<PricePickerResult | null> {
    if (this.isActive) {
      logger.warn('Price picker already active');
      return Promise.resolve(null);
    }

    logger.info('Activating price picker mode');
    this.isActive = true;

    return new Promise((resolve) => {
      this.resolveCallback = resolve;
      this.injectUI();
      this.attachEventListeners();
    });
  }

  /**
   * Deactivate price picker and clean up
   */
  deactivate(result: PricePickerResult | null = null) {
    if (!this.isActive) return;

    logger.info('Deactivating price picker mode', { hadResult: !!result });
    this.isActive = false;

    this.removeUI();
    this.removeEventListeners();

    if (this.resolveCallback) {
      this.resolveCallback(result);
      this.resolveCallback = null;
    }
  }

  /**
   * Inject overlay and tooltip UI
   */
  private injectUI() {
    // Create semi-transparent overlay
    this.overlay = document.createElement('div');
    this.overlay.id = 'price-picker-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.3);
      z-index: 2147483646; /* High z-index but not max */
      cursor: crosshair;
      backdrop-filter: blur(1px);
    `;

    // Create instruction banner
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 32px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      z-index: 2147483647; /* Max z-index */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 16px;
      font-weight: 600;
      text-align: center;
      pointer-events: none;
    `;
    banner.innerHTML = `
      🎯 Click on the price element<br>
      <span style="font-size: 12px; font-weight: 400; opacity: 0.9;">Press ESC to cancel</span>
    `;
    this.overlay.appendChild(banner);

    // Create tooltip
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'price-picker-tooltip';
    this.tooltip.style.cssText = `
      position: absolute;
      background: white;
      color: #333;
      padding: 8px 12px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      z-index: 2147483647;
      pointer-events: none;
      max-width: 300px;
      word-break: break-word;
      display: none;
      border: 2px solid #667eea;
    `;
    this.overlay.appendChild(this.tooltip);

    document.body.appendChild(this.overlay);
    document.body.style.cursor = 'crosshair';

    logger.debug('Price picker UI injected');
  }

  /**
   * Remove overlay and tooltip
   */
  private removeUI() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    if (this.tooltip) {
      this.tooltip = null;
    }

    this.removeHighlight();
    document.body.style.cursor = '';

    logger.debug('Price picker UI removed');
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners() {
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundClick = this.handleClick.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);

    document.addEventListener('mousemove', this.boundMouseMove, true);
    document.addEventListener('click', this.boundClick, true);
    document.addEventListener('keydown', this.boundKeyDown, true);
  }

  /**
   * Remove event listeners
   */
  private removeEventListeners() {
    if (this.boundMouseMove) {
      document.removeEventListener('mousemove', this.boundMouseMove, true);
      this.boundMouseMove = null;
    }

    if (this.boundClick) {
      document.removeEventListener('click', this.boundClick, true);
      this.boundClick = null;
    }

    if (this.boundKeyDown) {
      document.removeEventListener('keydown', this.boundKeyDown, true);
      this.boundKeyDown = null;
    }
  }

  /**
   * Handle mouse move - highlight element under cursor
   */
  private handleMouseMove(e: MouseEvent) {
    if (!this.isActive) return;

    // Get element under cursor (ignore overlay and tooltip)
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const targetElement = elements.find(
      (el) =>
        el !== this.overlay &&
        el !== this.tooltip &&
        !this.overlay?.contains(el) &&
        el.tagName !== 'HTML' &&
        el.tagName !== 'BODY'
    ) as HTMLElement | undefined;

    if (!targetElement || targetElement === this.highlightedElement) {
      return;
    }

    // Highlight new element
    this.highlightElement(targetElement);

    // Update tooltip
    this.updateTooltip(targetElement, e.clientX, e.clientY);
  }

  /**
   * Handle click - select element
   */
  private handleClick(e: MouseEvent) {
    if (!this.isActive) return;

    e.preventDefault();
    e.stopPropagation();

    // Get clicked element (ignore overlay)
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const targetElement = elements.find(
      (el) =>
        el !== this.overlay &&
        el !== this.tooltip &&
        !this.overlay?.contains(el) &&
        el.tagName !== 'HTML' &&
        el.tagName !== 'BODY'
    ) as HTMLElement | undefined;

    if (!targetElement) {
      logger.warn('No valid element clicked');
      return;
    }

    this.selectElement(targetElement);
  }

  /**
   * Handle keyboard - ESC to cancel
   */
  private handleKeyDown(e: KeyboardEvent) {
    if (!this.isActive) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      logger.info('Price picker cancelled by user');
      this.deactivate(null);
    }
  }

  /**
   * Highlight element
   */
  private highlightElement(element: HTMLElement) {
    // Remove previous highlight
    this.removeHighlight();

    // Add highlight class
    this.highlightedElement = element;
    element.classList.add('price-picker-highlight');

    // Apply highlight styles
    element.style.setProperty('outline', '3px solid #667eea', 'important');
    element.style.setProperty('outline-offset', '2px', 'important');
    element.style.setProperty('background-color', 'rgba(102, 126, 234, 0.1)', 'important');
    element.style.setProperty('transition', 'all 0.2s ease', 'important');
  }

  /**
   * Remove highlight from current element
   */
  private removeHighlight() {
    if (this.highlightedElement) {
      this.highlightedElement.classList.remove('price-picker-highlight');
      this.highlightedElement.style.removeProperty('outline');
      this.highlightedElement.style.removeProperty('outline-offset');
      this.highlightedElement.style.removeProperty('background-color');
      this.highlightedElement.style.removeProperty('transition');
      this.highlightedElement = null;
    }
  }

  /**
   * Update tooltip content and position
   */
  private updateTooltip(element: HTMLElement, x: number, y: number) {
    if (!this.tooltip) return;

    const text = element.textContent?.trim() || '';
    const previewText = text.length > 50 ? text.substring(0, 50) + '...' : text;

    // Check if text looks like a price
    const isPricelike = looksLikePrice(text);
    const statusIcon = isPricelike ? '✅' : '⚠️';
    const statusText = isPricelike ? 'Looks like a price' : 'Might not be a price';

    this.tooltip.innerHTML = `
      <div style="margin-bottom: 4px; font-weight: 600; color: ${
        isPricelike ? '#10b981' : '#f59e0b'
      };">
        ${statusIcon} ${statusText}
      </div>
      <div style="color: #666; font-size: 12px;">${previewText || '(empty)'}</div>
    `;

    // Position tooltip near cursor
    const tooltipWidth = 300;
    const tooltipHeight = 80;
    const offsetX = 15;
    const offsetY = 15;

    let left = x + offsetX;
    let top = y + offsetY;

    // Keep tooltip in viewport
    if (left + tooltipWidth > window.innerWidth) {
      left = x - tooltipWidth - offsetX;
    }

    if (top + tooltipHeight > window.innerHeight) {
      top = y - tooltipHeight - offsetY;
    }

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.display = 'block';
  }

  /**
   * Select element and generate CSS selector
   */
  private selectElement(element: HTMLElement) {
    const text = element.textContent?.trim() || '';

    // Validate that text looks like a price
    if (!looksLikePrice(text)) {
      logger.warn('Selected element does not look like a price', { text });

      // Show error message
      if (this.tooltip) {
        this.tooltip.innerHTML = `
          <div style="color: #ef4444; font-weight: 600; margin-bottom: 4px;">
            ❌ This doesn't look like a price
          </div>
          <div style="color: #666; font-size: 12px;">
            Please select an element that contains a price with currency symbol.
          </div>
        `;

        setTimeout(() => {
          if (this.tooltip) {
            this.tooltip.style.display = 'none';
          }
        }, 2000);
      }

      return;
    }

    // Remove temporary highlight helper class before generating selector
    this.removeHighlight();

    // Generate CSS selector (ignoring helper classes)
    const selector = this.generateCssSelector(element);

    if (!selector) {
      logger.error('Failed to generate CSS selector for element');
      this.deactivate(null);
      return;
    }

    logger.info('Element selected successfully', {
      selector,
      text: text.substring(0, 50),
    });

    // Return result
    this.deactivate({
      selector,
      text,
      success: true,
    });
  }

  /**
   * Generate unique CSS selector for element
   * Priority: ID > specific classes > DOM structure
   */
  private generateCssSelector(element: HTMLElement): string | null {
    try {
      // Priority 1: ID
      if (element.id) {
        const idSelector = `#${CSS.escape(element.id)}`;
        if (this.validateSelector(idSelector, element)) {
          return idSelector;
        }
      }

      // Priority 2: Price-related classes (excluding picker helpers)
      const priceClasses = ['price', 'cost', 'amount', 'value', 'pricing'];
      const classList = Array.from(element.classList).filter(
        className => !className.startsWith('price-picker')
      );

      for (const priceClass of priceClasses) {
        for (const className of classList) {
          if (className.toLowerCase().includes(priceClass)) {
            const classSelector = `.${CSS.escape(className)}`;
            if (this.validateSelector(classSelector, element)) {
              return classSelector;
            }
          }
        }
      }

      // Priority 3: Combination of classes
      if (classList.length > 0) {
        const classSelector = classList
          .map(className => `.${CSS.escape(className)}`)
          .join('');
        if (this.validateSelector(classSelector, element)) {
          return classSelector;
        }
      }

      // Priority 4: DOM path (with nth-child)
      const path = this.getDomPath(element);
      if (this.validateSelector(path, element)) {
        return path;
      }

      logger.warn('Could not generate unique selector', { element });
      return null;
    } catch (error) {
      logger.error('Error generating CSS selector', { error });
      return null;
    }
  }

  /**
   * Generate DOM path selector (limited depth)
   */
  private getDomPath(element: HTMLElement, maxDepth = 5): string {
    const segments: string[] = [];
    let current: HTMLElement | null = element;
    let depth = 0;

    while (current && current.tagName !== 'BODY' && depth < maxDepth) {
      let segment = current.tagName.toLowerCase();

      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children).filter(
          sibling => sibling.tagName === current!.tagName
        );

        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          segment += `:nth-child(${index})`;
        }
      }

      segments.unshift(segment);
      current = current.parentElement;
      depth++;
    }

    return segments.join(' > ');
  }

  /**
   * Validate that selector uniquely identifies the element
   */
  private validateSelector(selector: string, element: HTMLElement): boolean {
    try {
      const matches = document.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === element;
    } catch (error) {
      logger.warn('Invalid selector', { selector, error });
      return false;
    }
  }
}
