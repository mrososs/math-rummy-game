import { describe, expect, it } from 'vitest';

import { normalizeRoomCode } from './network-contracts';

describe('normalizeRoomCode', () => {
  it('keeps a portable four-character room code', () => {
    expect(normalizeRoomCode(' k4-p9 ')).toBe('K4P9');
  });
});
