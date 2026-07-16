import { describe, expect, it } from 'vitest';

import {
  parseLiveRoomSnapshot,
  validatePlayerSnapshot,
} from './room-repository';

const wellFormedSnapshot = {
  gameId: 'match-1',
  stateVersion: 3,
  viewerId: 'u1',
  round: 1,
  status: 'playing',
  activePlayerId: 'u1',
  activePlayerIndex: 0,
  turnStep: 'draw',
  deckCount: 80,
  discardCount: 1,
  discardTop: { id: 'n-5-0', kind: 'number', value: 5 },
  winnerId: null,
  players: [
    {
      id: 'u1',
      name: 'Maya',
      seat: 1,
      phaseId: 1,
      score: 0,
      cardCount: 10,
      completedPhase: false,
      laidMelds: [],
    },
  ],
  myHand: [
    { id: 'n-2-0', kind: 'number', value: 2 },
    { id: 'wild-0', kind: 'wild' },
  ],
  actionLog: [],
};

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

describe('validatePlayerSnapshot', () => {
  it('accepts a well-formed snapshot and preserves the private hand', () => {
    const snapshot = validatePlayerSnapshot(wellFormedSnapshot);
    expect(snapshot.viewerId).toBe('u1');
    expect(snapshot.myHand).toHaveLength(2);
    expect(snapshot.players[0].cardCount).toBe(10);
  });

  it('rejects a snapshot with an invalid status', () => {
    expect(() =>
      validatePlayerSnapshot({ ...wellFormedSnapshot, status: 'hacked' }),
    ).toThrow(/invalid snapshot status/i);
  });

  it('rejects a snapshot with a malformed card in hand', () => {
    expect(() =>
      validatePlayerSnapshot({
        ...wellFormedSnapshot,
        myHand: [{ id: 'x', kind: 'plutonium' }],
      }),
    ).toThrow(/invalid card kind/i);
  });

  it('rejects a snapshot missing its collections', () => {
    const { myHand, ...withoutHand } = wellFormedSnapshot;
    void myHand;
    expect(() => validatePlayerSnapshot(withoutHand)).toThrow(
      /invalid snapshot collections/i,
    );
  });
});
