/**
 * Tier system validation tests
 */

import { describe, it, expect } from 'vitest';
import { getAdapterForUrl, getTierInfo, getBadgeInfo } from '../../src/adapters/registry';
import { getSiteInfo, isSupportedSite } from '../../src/config/supportedSites';

describe('Adapter tier registry', () => {
  it('detects Tier 1 (specific) adapters', () => {
    const amazonTier = getTierInfo('https://www.amazon.es/dp/B08N5WRWNW');
    expect(amazonTier.tier).toBe('specific');
    expect(amazonTier.level).toBe(1);
    expect(amazonTier.adapterName).toBe('amazon');

    const pccomTier = getTierInfo('https://www.pccomponentes.com/asus-rog');
    expect(pccomTier.tier).toBe('specific');
    expect(pccomTier.adapterName).toBe('pccomponentes');
  });

  it('detects Tier 2 (whitelist) sites', () => {
    const tier = getTierInfo('https://www.fnac.es/consola/producto');
    expect(tier.tier).toBe('whitelist');
    expect(tier.level).toBe(2);
    expect(tier.adapterName).toBe('enhanced-generic');
    expect(tier.siteInfo?.name).toBeDefined();
  });

  it('falls back to manual tier for unknown stores', () => {
    const tier = getTierInfo('https://unknown-store.com/product/123');
    expect(tier.tier).toBe('manual');
    expect(tier.level).toBe(3);
  });

  it('marks non-commerce URLs as unsupported', () => {
    const tier = getTierInfo('https://www.youtube.com/watch?v=lorem');
    expect(tier.tier === 'none' || tier.tier === 'manual').toBeTruthy();
  });

  it('returns badge metadata per tier', () => {
    const badgeSpecific = getBadgeInfo('https://amazon.es/dp/123');
    expect(badgeSpecific.emoji).toBe('✓');
    expect(badgeSpecific.text.toLowerCase()).toContain('amazon');
    expect(badgeSpecific.level).toBe(1);

    const badgeManual = getBadgeInfo('https://unknown.example/product');
    expect(badgeManual.emoji === '📍' || badgeManual.emoji === '—').toBeTruthy();
  });

  it('returns correct adapter implementation', () => {
    expect(getAdapterForUrl('https://amazon.com/dp/123').name).toBe('amazon');
    expect(getAdapterForUrl('https://www.mediamarkt.es/producto/xiaomi').name).toBe('mediamarkt');
    expect(getAdapterForUrl('https://www.fnac.es/producto/123').name).toBe('enhanced-generic');
    expect(getAdapterForUrl('https://unknown-store.com/product/123').name).toBe('generic');
  });
});

describe('Whitelist metadata helpers', () => {
  it('exposes site info for known domains', () => {
    expect(isSupportedSite('pccomponentes.com')).toBe(true);
    const siteInfo = getSiteInfo('mediamarkt.es');
    expect(siteInfo?.name).toContain('MediaMarkt');
  });

  it('returns undefined for unsupported domains', () => {
    expect(isSupportedSite('not-a-store.example')).toBe(false);
    expect(getSiteInfo('not-a-store.example')).toBeUndefined();
  });
});
