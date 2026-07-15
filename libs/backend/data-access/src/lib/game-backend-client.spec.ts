import { describe, expect, it } from 'vitest';

import { createGameBackendClient } from './game-backend-client';

describe('createGameBackendClient', () => {
  it('requires an explicit public configuration', () => {
    expect(() =>
      createGameBackendClient({ url: '', publishableKey: '' }),
    ).toThrow(/required/i);
  });
});
