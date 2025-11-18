/**
 * Product Page Detector - Detects if current page is actually a product page
 * Prevents showing "Track Price" button on non-product pages (homepage, category, cart, etc.)
 */

import { logger } from "./logger";

/**
 * Non-product URL patterns for major e-commerce sites
 */
const NON_PRODUCT_PATTERNS = [
  // Amazon
  "/gp/your-account",
  "/your-account",
  "/cpe/yourpayments",
  "/gp/cart",
  "/cart",
  "/wishlist",
  "/history",
  "/orders",
  "/s/", // search
  "/b/", // browse categories
  "/gp/bestsellers",
  "/gp/new-releases",
  "/gp/goldbox",
  "/gp/browse",
  "/ap/signin",
  "/gp/css/homepage.html",

  // eBay
  "/mye/",
  "/cart/",
  "/wishlist/",
  "/sch/", // search
  "/b/", // categories
  "/ctg/", // categories
  "/d/", // deals
  "/itm/", // item - this IS a product, will be handled separately

  // AliExpress
  "/category/",
  "/cart",
  "/wishlist",
  "/user/",
  "/order",
  "/search",
  "/store/",
  "/wholesale",

  // General e-commerce patterns
  "/cart",
  "/checkout",
  "/wishlist",
  "/account",
  "/profile",
  "/login",
  "/register",
  "/contact",
  "/about",
  "/help",
  "/faq",
  "/blog",
  "/news",
  "/reviews",
  "/compare",
  "/search",
  "/category",
  "/categories",
  "/collection",
  "/collections",
  "/brand",
  "/brands",
  "/sale",
  "/sales",
  "/deals",
  "/clearance",
  "/outlet",
  "/store",
  "/stores",
  "/shop",
  "/shops",
];

/**
 * Product URL patterns for major e-commerce sites
 */
const PRODUCT_PATTERNS = [
  // Amazon
  "/dp/",
  "/gp/product/",
  "/product/",

  // eBay
  "/itm/",

  // AliExpress
  "/item/",

  // General patterns
  "/product/",
  "/products/",
  "/p/",
  "/item/",
  "/items/",
  "/articulo/",
  "/producto/",
  "/listing/",
  "/product-",
  "-product/",
];

/**
 * Check if URL is likely a product page
 */
export function isProductPage(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();

    // First check for strong product indicators
    if (hasStrongProductPattern(pathname)) {
      logger.debug("Strong product pattern detected", { url });
      return true;
    }

    // Then check for non-product patterns (negative signals)
    if (hasNonProductPattern(pathname)) {
      logger.debug("Non-product pattern detected", { url });
      return false;
    }

    // If no clear patterns, check for product-like structure
    return hasProductLikeStructure(pathname);
  } catch (error) {
    logger.error("Failed to detect product page", error);
    return false; // Fail safe - don't show button if uncertain
  }
}

/**
 * Check for strong product patterns
 */
function hasStrongProductPattern(pathname: string): boolean {
  return PRODUCT_PATTERNS.some((pattern) => pathname.includes(pattern));
}

/**
 * Check for non-product patterns
 */
function hasNonProductPattern(pathname: string): boolean {
  return NON_PRODUCT_PATTERNS.some((pattern) => pathname.includes(pattern));
}

/**
 * Check if URL has product-like structure
 */
function hasProductLikeStructure(pathname: string): boolean {
  // Look for patterns like /category/product-name-12345
  const segments = pathname.split("/").filter((segment) => segment.length > 0);

  if (segments.length < 2) {
    return false; // Too simple to be a product page
  }

  // Check if last segment looks like a product identifier
  const lastSegment = segments[segments.length - 1];

  // Common product identifier patterns
  const productIdPatterns = [
    /\d{6,}/, // 6+ digits (common product IDs)
    /[a-z0-9]{8,}/i, // 8+ alphanumeric (Amazon ASIN style)
    /-[a-z0-9]{6,}$/i, // Ends with dash + 6+ alphanumeric
    /\/[a-z0-9]{6,}$/i, // Ends with 6+ alphanumeric
  ];

  return productIdPatterns.some((pattern) => pattern.test(lastSegment));
}

/**
 * Get explanation of why page was/wasn't detected as product page
 */
export function getProductPageExplanation(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();

    if (hasStrongProductPattern(pathname)) {
      const matchedPattern = PRODUCT_PATTERNS.find((pattern) =>
        pathname.includes(pattern)
      );
      return `Product page detected: URL contains "${matchedPattern}"`;
    }

    if (hasNonProductPattern(pathname)) {
      const matchedPattern = NON_PRODUCT_PATTERNS.find((pattern) =>
        pathname.includes(pattern)
      );
      return `Not a product page: URL contains "${matchedPattern}"`;
    }

    if (hasProductLikeStructure(pathname)) {
      return "Product page detected: URL has product-like structure";
    }

    return "Not a product page: URL doesn't match product patterns";
  } catch {
    return "Unable to analyze this URL";
  }
}

/**
 * Enhanced detection for specific sites
 */
export function isProductPageForSite(url: string, site: string): boolean {
  const lowerUrl = url.toLowerCase();

  switch (site) {
    case "amazon":
      // Amazon specific logic
      return (
        lowerUrl.includes("/dp/") ||
        lowerUrl.includes("/gp/product/") ||
        lowerUrl.includes("/product/")
      );

    case "ebay":
      // eBay specific logic
      return lowerUrl.includes("/itm/");

    case "aliexpress":
      // AliExpress specific logic
      return lowerUrl.includes("/item/");

    default:
      // Use general detection
      return isProductPage(url);
  }
}
