import { describe, expect, it } from 'vitest';

import { parseLiveRoomSnapshot } from './room-repository';

describe('parseLiveRoomSnapshot', () => {
  it('maps the database RPC payload into the shared room contract', () => {
    const snapshot = parseLiveRoomSnapshot({
      roomId: '31db312c-93fc-46d0-93a6-d7461fa2b0e8',
      stateVersion: 2,
      gameState: { id: 'match-room-ABCD' },
      room: {
        code: 'ABCD',
        maxPlayers: 4,
        hostId: '8cc75ca9-5f78-432f-a1b7-a982987674d9',
        status: 'playing',
        transport: 'wifi',
        players: [
          {
            id: '8cc75ca9-5f78-432f-a1b7-a982987674d9',
            name: 'Maya',
            seat: 1,
            color: '#2563EB',
            isHost: true,
            isReady: true,
            cardsRemaining: 10,
            connection: 'strong',
            transport: 'wifi',
          },
        ],
      },
    });

    expect(snapshot.room.code).toBe('ABCD');
    expect(snapshot.room.players[0]).toMatchObject({
      name: 'Maya',
      isHost: true,
    });
    expect(snapshot.stateVersion).toBe(2);
  });

  it('rejects a malformed payload instead of poisoning game state', () => {
    expect(() =>
      parseLiveRoomSnapshot({ roomId: 'room', stateVersion: 0 }),
    ).toThrow(/invalid room/i);
  });
});
