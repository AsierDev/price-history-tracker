import { getTierInfo, type SupportTier } from "../adapters/registry";
import { isLikelyEcommerceSite } from "../utils/ecommerceDetector";
import {
  isProductPage,
  isProductPageForSite,
} from "../utils/productPageDetector";

export type SupportMode = SupportTier;

/**
 * Decide the support tier for the current URL and DOM snapshot.
 * This stays in its own module so tests can import it without forcing the
 * content script bundle to remain an ES module.
 */
export function resolveSupportMode(url: string, doc: Document): SupportMode {
  const tierInfo = getTierInfo(url);

  // For specific and whitelist tiers, also check if it's a product page
  if (tierInfo.tier === "specific" || tierInfo.tier === "whitelist") {
    const isProduct = isProductPageForSite(
      url,
      tierInfo.siteName?.toLowerCase() || ""
    );
    return isProduct ? tierInfo.tier : "none";
  }

  if (tierInfo.tier === "manual") {
    const ecommerce = isLikelyEcommerceSite(doc, url);
    if (!ecommerce) {
      return "none";
    }

    // For manual tier, also check if it's a product page
    const isProduct = isProductPage(url);
    return isProduct ? "manual" : "none";
  }

  return tierInfo.tier;
}

/**
 * Check if a URL should show the tracking button
 * This combines tier detection with product page detection
 */
export function shouldShowTrackingButton(url: string, doc: Document): boolean {
  const supportMode = resolveSupportMode(url, doc);
  return supportMode !== "none";
}
