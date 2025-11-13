/**
 * Belboon adapter - STUB (not implemented)
 * TODO: Implement when Belboon integration is ready
 */

import { StubAdapter } from './stub.adapter';

export class BelboonAdapter extends StubAdapter {
  constructor() {
    super({
      name: 'belboon',
      affiliateNetworkId: 'belboon',
      errorMessage: 'Belboon adapter not implemented yet',
    });
  }
}
