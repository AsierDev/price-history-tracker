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

/**
 * Clean URL aggressively for backend storage
 * Removes all tracking parameters and normalizes format
 */
export function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Tracking parameters to remove
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'ref', 'tag', '_skw', 'pd_rd_i', 'pd_rd_w', 'pd_rd_wg', 'pd_rd_r',
      'pf_rd_p', 'pf_rd_r', 'pf_rd_s', 'pf_rd_t', 'pf_rd_i', 'pf_rd_m',
      'aref', 'sp_csd', 'th', 'psc', 'qid', 'sr', 'keywords',
      'fbclid', 'gclid', 'msclkid', '_ga', 'mc_cid', 'mc_eid',
    ];

    trackingParams.forEach(param => urlObj.searchParams.delete(param));

    // Normalize: remove trailing slash, lowercase hostname
    urlObj.hostname = urlObj.hostname.toLowerCase();
    let cleanedUrl = urlObj.toString();
    if (cleanedUrl.endsWith('/')) {
      cleanedUrl = cleanedUrl.slice(0, -1);
    }

    return cleanedUrl;
  } catch {
    return url;
  }
}

/**
 * Generate hash for URL to use as Firestore document ID
 * Uses base64 encoding and sanitizes for Firestore compatibility
 */
export function hashUrl(url: string): string {
  try {
    // Simple base64 hash (for MVP, could use SHA-256 for production)
    const base64 = btoa(url);
    
    // Firestore document IDs must be valid UTF-8 and < 1500 bytes
    // Remove special characters and limit length
    const sanitized = base64
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 64);

    return sanitized || 'unknown';
  } catch {
    // Fallback: use simple hash
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
