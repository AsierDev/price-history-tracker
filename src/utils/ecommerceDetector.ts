/**
 * E-commerce Detector - Smart detection of online stores
 * Prevents showing "Track Price" button on non-store sites (Google, YouTube, etc.)
 */

import { logger } from './logger';

// Blacklist of known non-ecommerce domains
const NON_ECOMMERCE_DOMAINS = new Set([
  // Search engines
  'google.com',
  'bing.com',
  'yahoo.com',
  'duckduckgo.com',
  'baidu.com',
  
  // Social media
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'pinterest.com',
  'reddit.com',
  'tiktok.com',
  'snapchat.com',
  
  // Video platforms
  'youtube.com',
  'vimeo.com',
  'twitch.tv',
  'dailymotion.com',
  
  // Email & productivity
  'gmail.com',
  'outlook.com',
  'mail.google.com',
  'docs.google.com',
  'drive.google.com',
  'dropbox.com',
  
  // Development
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'stackoverflow.com',
  'stackexchange.com',
  
  // News & media
  'wikipedia.org',
  'medium.com',
  'dev.to',
  'news.ycombinator.com',
  
  // Other
  'localhost',
  '127.0.0.1',
]);

// Whitelist of known e-commerce domains (not covered by specific adapters)
const ECOMMERCE_DOMAINS = new Set([
  // Spanish stores
  'pccomponentes.com',
  'mediamarkt.es',
  'elcorteingles.es',
  'carrefour.es',
  'fnac.es',
  'worten.es',
  'coolmod.com',
  'aussar.es',
  'wallapop.com',
  
  // International stores
  'etsy.com',
  'walmart.com',
  'target.com',
  'bestbuy.com',
  'newegg.com',
  'bhphotovideo.com',
  
  // Fashion
  'zara.com',
  'hm.com',
  'asos.com',
  'zalando.es',
  'shein.com',
  
  // Tech
  'apple.com',
  'microsoft.com',
  'dell.com',
  'hp.com',
  'lenovo.com',
]);

/**
 * Check if a site is likely an e-commerce store
 * Returns true if site appears to sell products
 */
export function isLikelyEcommerceSite(document: Document, url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');

    // 1. Check blacklist first (fast exit)
    if (isInDomainList(hostname, NON_ECOMMERCE_DOMAINS)) {
      logger.debug('Site is in non-ecommerce blacklist', { hostname });
      return false;
    }

    // 2. Check whitelist (fast positive)
    if (isInDomainList(hostname, ECOMMERCE_DOMAINS)) {
      logger.debug('Site is in ecommerce whitelist', { hostname });
      return true;
    }

    // 3. Calculate score based on multiple signals
    let score = 0;

    // Signal 1: JSON-LD structured data (strongest signal)
    if (hasProductStructuredData(document)) {
      score += 50;
      logger.debug('Found Product structured data', { score });
    }

    // Signal 2: Product meta tags
    if (hasProductMetaTags(document)) {
      score += 30;
      logger.debug('Found product meta tags', { score });
    }

    // Signal 3: E-commerce DOM elements
    const domScore = countEcommerceDomElements(document);
    score += Math.min(domScore * 5, 25); // Max 25 points
    logger.debug('E-commerce DOM elements found', { count: domScore, score });

    // Signal 4: URL patterns
    if (hasProductUrlPattern(url)) {
      score += 15;
      logger.debug('URL matches product pattern', { score });
    }

    // Signal 5: E-commerce keywords in text
    if (hasEcommerceKeywords(document)) {
      score += 10;
      logger.debug('Found e-commerce keywords', { score });
    }

    const isEcommerce = score >= 50;
    logger.info('E-commerce detection result', { hostname, score, isEcommerce });

    return isEcommerce;
  } catch (error) {
    logger.error('Failed to detect e-commerce site', error);
    return false; // Fail safe - don't show button if uncertain
  }
}

// ============================================================================
// Signal Detection Functions
// ============================================================================

/**
 * Check if domain is in a list (handles subdomains)
 */
function isInDomainList(hostname: string, domainList: Set<string>): boolean {
  // Exact match
  if (domainList.has(hostname)) {
    return true;
  }

  // Check if it's a subdomain of any listed domain
  for (const domain of domainList) {
    if (hostname.endsWith('.' + domain)) {
      return true;
    }
  }

  return false;
}

/**
 * Check for Product structured data (JSON-LD)
 */
function hasProductStructuredData(document: Document): boolean {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  
  for (const script of Array.from(scripts)) {
    try {
      const data = JSON.parse(script.textContent || '');
      
      // Check @type directly
      if (isProductType(data['@type'])) {
        return true;
      }

      // Check in array
      if (Array.isArray(data)) {
        if (data.some(item => isProductType(item['@type']))) {
          return true;
        }
      }

      // Check in @graph
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        if (data['@graph'].some((item: { '@type': string }) => isProductType(item['@type']))) {
          return true;
        }
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  return false;
}

/**
 * Check if @type indicates a product
 */
function isProductType(type: string | string[] | undefined): boolean {
  if (!type) return false;

  const productTypes = ['Product', 'Offer', 'AggregateOffer', 'ProductCollection'];
  
  if (typeof type === 'string') {
    return productTypes.includes(type);
  }

  if (Array.isArray(type)) {
    return type.some(t => productTypes.includes(t));
  }

  return false;
}

/**
 * Check for product-related meta tags
 */
function hasProductMetaTags(document: Document): boolean {
  const productMetaTags = [
    'meta[property="og:type"][content="product"]',
    'meta[property="product:price:amount"]',
    'meta[property="product:price:currency"]',
    'meta[name="twitter:data1"]', // Often used for price
  ];

  return productMetaTags.some(selector => document.querySelector(selector) !== null);
}

/**
 * Count e-commerce DOM elements
 */
function countEcommerceDomElements(document: Document): number {
  let count = 0;

  // Common e-commerce class/ID patterns
  const patterns = [
    // Product
    '.product',
    '.product-page',
    '#product',
    '[class*="product-"]',
    
    // Price
    '.price',
    '.product-price',
    '#price',
    '[class*="price"]',
    '[itemprop="price"]',
    
    // Cart/Checkout
    '.add-to-cart',
    '.buy-now',
    '.checkout',
    '.cart',
    '[class*="add-to-cart"]',
    '[class*="buy-now"]',
    
    // Quantity
    '.quantity',
    'input[name="quantity"]',
  ];

  for (const pattern of patterns) {
    try {
      const elements = document.querySelectorAll(pattern);
      if (elements.length > 0) {
        count++;
      }
    } catch {
      // Invalid selector, skip
    }
  }

  return count;
}

/**
 * Check if URL matches common product page patterns
 */
function hasProductUrlPattern(url: string): boolean {
  const productPatterns = [
    '/product/',
    '/products/',
    '/p/',
    '/item/',
    '/items/',
    '/dp/', // Amazon
    '/itm/', // eBay
    '/articulo/',
    '/producto/',
    '/listing/', // Etsy
    '/product-',
    '-product/',
  ];

  const lowerUrl = url.toLowerCase();
  return productPatterns.some(pattern => lowerUrl.includes(pattern));
}

/**
 * Check for e-commerce keywords in page text
 */
function hasEcommerceKeywords(document: Document): boolean {
  const bodyText = document.body.textContent?.toLowerCase() || '';

  const keywords = [
    'add to cart',
    'añadir al carrito',
    'buy now',
    'comprar ahora',
    'in stock',
    'en stock',
    'out of stock',
    'agotado',
    'free shipping',
    'envío gratis',
    'delivery',
    'entrega',
  ];

  // Check if at least 2 keywords are present (reduces false positives)
  const matchCount = keywords.filter(keyword => bodyText.includes(keyword)).length;
  return matchCount >= 2;
}

/**
 * Get a human-readable explanation of why a site was/wasn't detected as e-commerce
 */
export function getDetectionExplanation(document: Document, url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');

    if (isInDomainList(hostname, NON_ECOMMERCE_DOMAINS)) {
      return 'This site is a known non-store (social media, search engine, etc.)';
    }

    if (isInDomainList(hostname, ECOMMERCE_DOMAINS)) {
      return 'This site is a known online store';
    }

    const signals: string[] = [];

    if (hasProductStructuredData(document)) {
      signals.push('product data found');
    }

    if (hasProductMetaTags(document)) {
      signals.push('product meta tags');
    }

    const domCount = countEcommerceDomElements(document);
    if (domCount > 0) {
      signals.push(`${domCount} e-commerce elements`);
    }

    if (hasProductUrlPattern(url)) {
      signals.push('product URL pattern');
    }

    if (hasEcommerceKeywords(document)) {
      signals.push('e-commerce keywords');
    }

    if (signals.length === 0) {
      return 'No e-commerce signals detected on this page';
    }

    return `Detected: ${signals.join(', ')}`;
  } catch {
    return 'Unable to analyze this page';
  }
}
