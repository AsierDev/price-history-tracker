import type { PriceAdapter } from '../types';
import type { ExtractedProductData } from '../../core/types';

interface StubAdapterOptions {
  name: string;
  affiliateNetworkId: string;
  currency?: string;
  errorMessage?: string;
}

export class StubAdapter implements PriceAdapter {
  name: string;
  affiliateNetworkId: string;
  enabled = false;
  urlPatterns: RegExp[] = [];
  private readonly errorMessage: string;
  private readonly currency: string;

  constructor(options: StubAdapterOptions) {
    this.name = options.name;
    this.affiliateNetworkId = options.affiliateNetworkId;
    this.errorMessage = options.errorMessage ?? `${options.name} adapter not implemented yet`;
    this.currency = options.currency ?? 'EUR';
  }

  canHandle(): boolean {
    return false;
  }

  async extractData(): Promise<ExtractedProductData> {
    return {
      title: 'Product',
      price: 0,
      currency: this.currency,
      available: false,
      error: this.errorMessage,
    };
  }

  generateAffiliateUrl(url: string): string {
    return url;
  }
}
