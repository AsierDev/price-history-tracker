import { getTierInfo, type SupportTier } from '../adapters/registry';
import { isLikelyEcommerceSite } from '../utils/ecommerceDetector';

export type SupportMode = SupportTier;

/**
 * Decide the support tier for the current URL and DOM snapshot.
 * This stays in its own module so tests can import it without forcing the
 * content script bundle to remain an ES module.
 */
export function resolveSupportMode(url: string, doc: Document): SupportMode {
  const tierInfo = getTierInfo(url);

  if (tierInfo.tier === 'manual') {
    const ecommerce = isLikelyEcommerceSite(doc, url);
    return ecommerce ? 'manual' : 'none';
  }

  return tierInfo.tier;
}
