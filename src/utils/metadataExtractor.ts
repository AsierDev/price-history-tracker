/**
 * Metadata Extractor - Automatic extraction of product info from generic sites
 */

import { logger } from './logger';

export interface ExtractedMetadata {
  title: string;
  imageUrl?: string;
  storeName: string;
}

/**
 * Extract product title from document
 * Priority: Open Graph > Twitter Card > JSON-LD > H1 > document.title > fallback
 */
export function extractTitle(document: Document): string {
  try {
    // 1. Try Open Graph meta tag
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      const content = ogTitle.getAttribute('content');
      if (content && content.trim().length > 0) {
        logger.debug('Title extracted from Open Graph', { title: content });
        return cleanTitle(content);
      }
    }

    // 2. Try Twitter Card meta tag
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) {
      const content = twitterTitle.getAttribute('content');
      if (content && content.trim().length > 0) {
        logger.debug('Title extracted from Twitter Card', { title: content });
        return cleanTitle(content);
      }
    }

    // 3. Try JSON-LD structured data
    const jsonLdTitle = extractFromJsonLd(document, 'name');
    if (jsonLdTitle && typeof jsonLdTitle === 'string') {
      logger.debug('Title extracted from JSON-LD', { title: jsonLdTitle });
      return cleanTitle(jsonLdTitle);
    }

    // 4. Try H1 tags (prefer ones with >5 words)
    const h1Elements = document.querySelectorAll('h1');
    for (const h1 of Array.from(h1Elements)) {
      const text = h1.textContent?.trim() || '';
      const wordCount = text.split(/\s+/).length;
      if (wordCount >= 5 && text.length > 10) {
        logger.debug('Title extracted from H1', { title: text });
        return cleanTitle(text);
      }
    }

    // Use first H1 if no long one found
    if (h1Elements.length > 0) {
      const text = h1Elements[0].textContent?.trim() || '';
      if (text.length > 0) {
        logger.debug('Title extracted from first H1', { title: text });
        return cleanTitle(text);
      }
    }

    // 5. Try document title (cleaned)
    if (document.title && document.title.trim().length > 0) {
      logger.debug('Title extracted from document.title', { title: document.title });
      return cleanTitle(document.title);
    }

    // 6. Fallback
    const domain = extractDomainFromDocument(document);
    const fallback = `Product from ${domain}`;
    logger.warn('Using fallback title', { title: fallback });
    return fallback;
  } catch (error) {
    logger.error('Failed to extract title', error);
    return 'Product from Website';
  }
}

/**
 * Extract product image URL from document
 * Priority: Open Graph > JSON-LD > nearest to price > main product image > fallback
 */
export function extractImage(document: Document, priceElement?: HTMLElement | null): string | undefined {
  try {
    // 1. Try Open Graph image
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) {
      const content = ogImage.getAttribute('content');
      if (content && isValidImageUrl(content)) {
        logger.debug('Image extracted from Open Graph', { url: content });
        return makeAbsoluteUrl(content, document);
      }
    }

    // 2. Try JSON-LD structured data
    const jsonLdImage = extractFromJsonLd(document, 'image');
    if (jsonLdImage) {
      const imageUrl = Array.isArray(jsonLdImage) ? jsonLdImage[0] : jsonLdImage;
      if (typeof imageUrl === 'string' && isValidImageUrl(imageUrl)) {
        logger.debug('Image extracted from JSON-LD', { url: imageUrl });
        return makeAbsoluteUrl(imageUrl, document);
      }
    }

    // 3. Try image nearest to price element
    if (priceElement) {
      const nearestImage = findNearestImage(priceElement);
      if (nearestImage) {
        logger.debug('Image extracted near price element', { url: nearestImage });
        return nearestImage;
      }
    }

    // 4. Try common product image selectors
    const productImageSelectors = [
      'img.product-image',
      'img.main-image',
      'img.hero-image',
      'img[itemprop="image"]',
      '.product-gallery img',
      '.product-photos img',
      '#product-image',
    ];

    for (const selector of productImageSelectors) {
      const img = document.querySelector(selector) as HTMLImageElement;
      if (img && img.src && isValidImageUrl(img.src)) {
        logger.debug('Image extracted from product selector', { selector, url: img.src });
        return makeAbsoluteUrl(img.src, document);
      }
    }

    // 5. Try first large image (>200x200px)
    const allImages = document.querySelectorAll('img');
    for (const img of Array.from(allImages)) {
      if (img.width >= 200 && img.height >= 200 && img.src && isValidImageUrl(img.src)) {
        // Skip logos, banners, ads
        if (isLikelyProductImage(img)) {
          logger.debug('Image extracted from large image', { url: img.src });
          return makeAbsoluteUrl(img.src, document);
        }
      }
    }

    // 6. Fallback - no image
    logger.warn('No product image found');
    return undefined;
  } catch (error) {
    logger.error('Failed to extract image', error);
    return undefined;
  }
}

/**
 * Extract store name from URL and document
 * Priority: JSON-LD Organization > og:site_name > cleaned domain
 */
export function extractStoreName(url: string, document: Document): string {
  try {
    // 1. Try JSON-LD Organization
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of Array.from(scripts)) {
      try {
        const data = JSON.parse(script.textContent || '');
        if (data['@type'] === 'Organization' && data.name) {
          logger.debug('Store name extracted from JSON-LD Organization', { name: data.name });
          return data.name;
        }
      } catch {
        // Invalid JSON, skip
      }
    }

    // 2. Try Open Graph site_name
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName) {
      const content = ogSiteName.getAttribute('content');
      if (content && content.trim().length > 0) {
        logger.debug('Store name extracted from og:site_name', { name: content });
        return content.trim();
      }
    }

    // 3. Clean domain name
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const storeName = cleanDomainName(hostname);
    logger.debug('Store name extracted from domain', { hostname, storeName });
    return storeName;
  } catch (error) {
    logger.error('Failed to extract store name', error);
    return 'Unknown Store';
  }
}

/**
 * Extract all metadata at once
 */
export function extractMetadata(
  document: Document,
  url: string,
  priceElement?: HTMLElement | null
): ExtractedMetadata {
  return {
    title: extractTitle(document),
    imageUrl: extractImage(document, priceElement),
    storeName: extractStoreName(url, document),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Clean title by removing store name, separators, and common suffixes
 */
function cleanTitle(title: string): string {
  let cleaned = title.trim();

  // Remove common separators and everything after them
  const separators = [' - ', ' | ', ' :: ', ' — '];
  for (const sep of separators) {
    const index = cleaned.indexOf(sep);
    if (index > 0) {
      // Keep the part before separator if it's substantial
      const beforeSep = cleaned.substring(0, index).trim();
      if (beforeSep.length >= 10) {
        cleaned = beforeSep;
        break;
      }
    }
  }

  // Remove common suffixes
  const suffixes = [
    'buy online',
    'comprar online',
    'best price',
    'mejor precio',
    'free shipping',
    'envío gratis',
  ];
  for (const suffix of suffixes) {
    const regex = new RegExp(`\\s*[\\-|:]?\\s*${suffix}\\s*$`, 'i');
    cleaned = cleaned.replace(regex, '');
  }

  // Limit length
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 97) + '...';
  }

  return cleaned.trim();
}

/**
 * Extract value from JSON-LD structured data
 */
function extractFromJsonLd(document: Document, field: string): string | unknown | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of Array.from(scripts)) {
    try {
      const data = JSON.parse(script.textContent || '');
      
      // Handle single object
      if (data['@type'] === 'Product' && data[field]) {
        return data[field];
      }

      // Handle array of objects
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item['@type'] === 'Product' && item[field]) {
            return item[field];
          }
        }
      }

      // Handle @graph structure
      if (data['@graph']) {
        for (const item of data['@graph']) {
          if (item['@type'] === 'Product' && item[field]) {
            return item[field];
          }
        }
      }
    } catch {
      // Invalid JSON, skip
    }
  }
  return null;
}

/**
 * Find nearest image to price element
 */
function findNearestImage(priceElement: HTMLElement): string | null {
  // Walk up DOM tree to find common container
  let container: HTMLElement | null = priceElement;
  let depth = 0;
  const maxDepth = 5;

  while (container && depth < maxDepth) {
    // Look for images in this container
    const images = container.querySelectorAll('img');
    const validImages: HTMLImageElement[] = [];

    for (const img of Array.from(images)) {
      if (
        img.width >= 50 &&
        img.height >= 50 &&
        img.src &&
        isValidImageUrl(img.src) &&
        isLikelyProductImage(img)
      ) {
        validImages.push(img);
      }
    }

    // Return largest image in this container
    if (validImages.length > 0) {
      const largest = validImages.reduce((prev, current) =>
        prev.width * prev.height > current.width * current.height ? prev : current
      );
      return makeAbsoluteUrl(largest.src, priceElement.ownerDocument);
    }

    container = container.parentElement;
    depth++;
  }

  return null;
}

/**
 * Check if URL looks like a valid image
 */
function isValidImageUrl(url: string): boolean {
  if (!url || url.length === 0) return false;
  
  // Skip data URLs, SVGs (often logos), and very short URLs
  if (url.startsWith('data:') || url.includes('.svg') || url.length < 10) {
    return false;
  }

  // Check for image extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some(ext => lowerUrl.includes(ext));
}

/**
 * Check if image is likely a product image (not logo, banner, ad)
 */
function isLikelyProductImage(img: HTMLImageElement): boolean {
  const src = img.src.toLowerCase();
  const alt = (img.alt || '').toLowerCase();
  const className = (img.className || '').toLowerCase();

  // Skip logos
  if (src.includes('logo') || alt.includes('logo') || className.includes('logo')) {
    return false;
  }

  // Skip banners
  if (src.includes('banner') || alt.includes('banner') || className.includes('banner')) {
    return false;
  }

  // Skip ads
  if (src.includes('/ad/') || src.includes('/ads/') || className.includes('ad-')) {
    return false;
  }

  return true;
}

/**
 * Make URL absolute if it's relative
 */
function makeAbsoluteUrl(url: string, document: Document): string {
  try {
    // Already absolute
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Protocol-relative
    if (url.startsWith('//')) {
      return 'https:' + url;
    }

    // Relative to domain
    const baseUrl = document.baseURI || window.location.href;
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

/**
 * Extract domain from document
 */
function extractDomainFromDocument(document: Document): string {
  try {
    const baseUrl = document.baseURI || window.location.href;
    const url = new URL(baseUrl);
    return cleanDomainName(url.hostname);
  } catch {
    return 'Website';
  }
}

/**
 * Clean domain name for display
 * Examples:
 * - "www.pccomponentes.com" → "PC Componentes"
 * - "mediamarkt.es" → "MediaMarkt"
 */
function cleanDomainName(hostname: string): string {
  // Remove www.
  let domain = hostname.replace(/^www\./, '');

  // Remove TLD (.com, .es, etc.)
  domain = domain.replace(/\.(com|es|co\.uk|de|fr|it|net|org|io)$/, '');

  // Special cases (known stores)
  const specialCases: Record<string, string> = {
    'pccomponentes': 'PC Componentes',
    'mediamarkt': 'MediaMarkt',
    'elcorteingles': 'El Corte Inglés',
    'carrefour': 'Carrefour',
    'fnac': 'Fnac',
    'worten': 'Worten',
    'coolmod': 'Coolmod',
    'aussar': 'Aussar',
    'amazon': 'Amazon',
    'ebay': 'eBay',
    'aliexpress': 'AliExpress',
  };

  if (specialCases[domain]) {
    return specialCases[domain];
  }

  // Capitalize first letter of each word
  return domain
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
