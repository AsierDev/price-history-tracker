/**
 * URL parsing and manipulation utilities
 */

export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove tracking parameters
    const cleanParams = new URLSearchParams();
    for (const [key, value] of urlObj.searchParams.entries()) {
      // Keep only essential params, remove tracking
      if (!key.startsWith('utm_') && !key.startsWith('ref') && key !== 'tag') {
        cleanParams.set(key, value);
      }
    }
    urlObj.search = cleanParams.toString();
    return urlObj.toString();
  } catch {
    return url;
  }
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function addQueryParam(url: string, key: string, value: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set(key, value);
    return urlObj.toString();
  } catch {
    return url;
  }
}
