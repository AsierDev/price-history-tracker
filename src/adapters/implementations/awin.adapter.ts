/**
 * AWIN adapter - STUB (not implemented)
 * TODO: Implement when AWIN integration is ready
 */

import { StubAdapter } from './stub.adapter';

export class AwinAdapter extends StubAdapter {
  constructor() {
    super({
      name: 'awin',
      affiliateNetworkId: 'awin',
      errorMessage: 'AWIN adapter not implemented yet',
    });
  }
}
