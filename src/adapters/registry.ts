/**
 * Adapter registry - Factory pattern for adapter discovery
 */

import type { PriceAdapter } from './types';
import { AmazonAdapter } from './implementations/amazon.adapter';
import { EbayAdapter } from './implementations/ebay.adapter';
import { AliExpressAdapter } from './implementations/aliexpress.adapter';
import { TradeTrackerAdapter } from './implementations/tradetracker.adapter';
import { BelboonAdapter } from './implementations/belboon.adapter';
import { AwinAdapter } from './implementations/awin.adapter';
import { PcComponentesAdapter } from './implementations/pccomponentes.adapter';
import { MediaMarktAdapter } from './implementations/mediamarkt.adapter';
import { genericAdapter } from './implementations/generic.adapter';
import { createEnhancedGenericAdapter } from './implementations/enhanced-generic.adapter';
import { logger } from '../utils/logger';
import type { SupportedSite } from '../config/supportedSites';
import { DOMAIN_MAP, SUPPORTED_ECOMMERCE_SITES } from '../config/supportedSites';

// Registry of specific adapters (priority order)
const specificAdapters: PriceAdapter[] = [
  new AmazonAdapter(),
  new EbayAdapter(),
  new AliExpressAdapter(),
  new PcComponentesAdapter(),
  new MediaMarktAdapter(),
  new TradeTrackerAdapter(),
  new BelboonAdapter(),
  new AwinAdapter(),
];

const adapters: PriceAdapter[] = [...specificAdapters, genericAdapter];

export type SupportTier = 'specific' | 'whitelist' | 'manual' | 'none';

export interface TierInfo {
  tier: SupportTier;
  level: 0 | 1 | 2 | 3;
  label: string;
  description: string;
  adapterName?: string;
  siteName?: string;
  siteInfo?: SupportedSite;
}

export interface BadgeInfo {
  emoji: string;
  text: string;
  tone: 'success' | 'info' | 'warning';
  level: 0 | 1 | 2 | 3;
}

const WHITELIST_SITES = DOMAIN_MAP;

const TIER_BASE: Record<SupportTier, { level: 0 | 1 | 2 | 3; label: string; description: string }> = {
  specific: {
    level: 1,
    label: 'Full Support',
    description: 'Adaptador específico con extracción automática',
  },
  whitelist: {
    level: 2,
    label: 'Verified Store',
    description: 'Sitio en whitelist con extracción mejorada',
  },
  manual: {
    level: 3,
    label: 'Manual Tracking',
    description: 'Requiere seleccionar el precio manualmente',
  },
  none: {
    level: 0,
    label: 'Not Supported',
    description: 'El sitio no parece ser una tienda online',
  },
};

function getDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return hostname;
  } catch {
    return null;
  }
}

function getWhitelistSite(url: string): SupportedSite | undefined {
  const hostname = getDomain(url);
  if (!hostname) return undefined;

  if (WHITELIST_SITES.has(hostname)) {
    return WHITELIST_SITES.get(hostname);
  }

  for (const site of SUPPORTED_ECOMMERCE_SITES) {
    if (hostname === site.domain || hostname.endsWith(`.${site.domain}`)) {
      return site;
    }
  }

  return undefined;
}

function createTierInfo(tier: SupportTier, overrides: Partial<TierInfo> = {}): TierInfo {
  const base = TIER_BASE[tier];
  return {
    tier,
    level: overrides.level ?? base.level,
    label: overrides.label ?? base.label,
    description: overrides.description ?? base.description,
    adapterName: overrides.adapterName,
    siteName: overrides.siteName,
    siteInfo: overrides.siteInfo,
  };
}

function getTierForUrl(url: string): TierInfo {
  if (!url) {
    return createTierInfo('none');
  }

  const domain = getDomain(url) || undefined;

  // Tier 1: specific adapter
  for (const adapter of specificAdapters) {
    if (adapter.enabled && adapter.canHandle(url)) {
      const siteName = domain || adapter.name;
      return createTierInfo('specific', {
        adapterName: adapter.name,
        siteName,
        description: `Soporte completo para ${siteName}`,
      });
    }
  }

  // Tier 2: whitelist domain (enhanced generic)
  const whitelistSite = getWhitelistSite(url);
  if (whitelistSite) {
    return createTierInfo('whitelist', {
      adapterName: 'enhanced-generic',
      siteName: whitelistSite.name,
      siteInfo: whitelistSite,
      description: `Whitelist verificada: ${whitelistSite.name}`,
    });
  }

  if (!domain) {
    return createTierInfo('none');
  }

  return createTierInfo('manual', {
    adapterName: genericAdapter.name,
    siteName: domain,
    description: `Selecciona manualmente el precio en ${domain}`,
  });
}

/**
 * Get the appropriate adapter for a given URL
 * Tries specific adapters first, then falls back to generic adapter
 */
export function getAdapterForUrl(url: string): PriceAdapter {
  const tierInfo = getTierForUrl(url);

  if (tierInfo.tier === 'specific') {
    const adapter = specificAdapters.find(a => a.name === tierInfo.adapterName);
    if (adapter) {
      logger.debug('Specific adapter found for URL', {
        adapter: adapter.name,
        url,
      });
      return adapter;
    }
  }

  if (tierInfo.tier === 'whitelist') {
    logger.debug('Using enhanced generic adapter for whitelist domain', {
      url,
      site: tierInfo.siteName,
    });
    return createEnhancedGenericAdapter(tierInfo.siteInfo);
  }

  logger.debug('Using manual generic adapter as fallback', { url });
  return genericAdapter;
}

/**
 * Get all enabled adapters
 */
export function getEnabledAdapters(): PriceAdapter[] {
  return adapters.filter(a => a.enabled);
}

/**
 * Get all adapters (including disabled)
 */
export function getAllAdapters(): PriceAdapter[] {
  return adapters;
}

/**
 * Expose tier info for testing/UI
 */
export function getTierInfo(url: string): TierInfo {
  return getTierForUrl(url);
}

/**
 * Provide badge metadata used by popup/content script
 */
export function getBadgeInfo(url: string): BadgeInfo {
  const tierInfo = getTierForUrl(url);

  switch (tierInfo.tier) {
    case 'specific':
      return {
        emoji: '✓',
        text: tierInfo.siteName ?? 'Auto',
        tone: 'success',
        level: tierInfo.level,
      };
    case 'whitelist':
      return {
        emoji: '✓',
        text: tierInfo.siteName ?? 'Whitelist',
        tone: 'info',
        level: tierInfo.level,
      };
    case 'none':
      return {
        emoji: '—',
        text: 'No soportado',
        tone: 'warning',
        level: tierInfo.level,
      };
    case 'manual':
    default:
      return {
        emoji: '📍',
        text: 'Manual',
        tone: 'warning',
        level: tierInfo.level,
      };
  }
}

/**
 * Check if a URL is supported by any specific adapter (not generic)
 */
export function isUrlSupported(url: string): boolean {
  const tier = getTierForUrl(url).tier;
  return tier === 'specific' || tier === 'whitelist';
}

/**
 * Check if a URL requires manual price selection (uses generic adapter)
 * Returns true only if NO specific adapter is found AND generic adapter is needed
 */
export function requiresManualSelection(url: string): boolean {
  return getTierForUrl(url).tier === 'manual';
}
