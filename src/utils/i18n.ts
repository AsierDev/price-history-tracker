/**
 * Internationalization helper utilities for Chrome extension
 */

/**
 * Translates a message key using Chrome's i18n API
 * @param key - The message key to translate
 * @returns The translated message or the key if not found
 */
export function t(key: string): string {
  return chrome.i18n.getMessage(key) || key;
}

/**
 * Gets the current UI language of the browser
 * @returns The current language code (e.g., 'en', 'es')
 */
export function getCurrentLanguage(): string {
  return chrome.i18n.getUILanguage();
}

/**
 * Translates all elements on the page with data-i18n attributes
 * This function should be called after DOM is loaded
 */
export function translatePage(): void {
  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (key) {
      element.textContent = t(key);
    }
  });
}
