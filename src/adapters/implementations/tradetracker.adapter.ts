/**
 * TradeTracker adapter - STUB (not implemented)
 * TODO: Implement when TradeTracker integration is ready
 */

import { StubAdapter } from './stub.adapter';

export class TradeTrackerAdapter extends StubAdapter {
  constructor() {
    super({
      name: 'tradetracker',
      affiliateNetworkId: 'tradetracker',
      errorMessage: 'TradeTracker adapter not implemented yet',
    });
  }
}
