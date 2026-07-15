import { describe, expect, it } from 'vitest';

import {
  assignWildValue,
  createMatch,
  discardCard,
  drawCard,
  hitMeld,
  layPhase,
} from './game-engine';

const players = [
  { id: 'p1', name: 'Maya', seat: 1 },
  { id: 'p2', name: 'Leo', seat: 2 },
];

describe('game engine', () => {
  it('enforces draw before discard and advances the turn', () => {
    const match = createMatch(players, {
      seed: 'turn-order',
      startingPlayerId: 'p1',
    });
    const afterDraw = drawCard(match, 'p1', 'deck');
    const discardId = afterDraw.players[0].hand[0].id;
    const afterDiscard = discardCard(afterDraw, 'p1', discardId);

    expect(afterDraw.turnStep).toBe('build');
    expect(afterDiscard.turnStep).toBe('draw');
    expect(afterDiscard.players[afterDiscard.activePlayerIndex].id).toBe('p2');
  });

  it('lays a complete phase and removes only its cards from the hand', () => {
    const match = createMatch(players, {
      seed: 'phase',
      startingPlayerId: 'p1',
      startingPhaseId: 2,
    });
    const prepared = {
      ...drawCard(match, 'p1', 'deck'),
      players: match.players.map((player) =>
        player.id === 'p1'
          ? {
              ...player,
              hand: [
                { id: 'a', kind: 'number' as const, value: 3 },
                { id: 'b', kind: 'number' as const, value: 9 },
                { id: 'c', kind: 'number' as const, value: 5 },
                { id: 'd', kind: 'number' as const, value: 7 },
                { id: 'keep', kind: 'number' as const, value: 1 },
              ],
            }
          : player,
      ),
    };

    const result = layPhase(prepared, 'p1', [
      { id: 'm1', cardIds: ['a', 'b'], operation: 'add' },
      { id: 'm2', cardIds: ['c', 'd'], operation: 'add' },
    ]);

    expect(result.players[0].completedPhase).toBe(true);
    expect(result.players[0].hand.map((card) => card.id)).toEqual(['keep']);
    expect(result.players[0].laidMelds).toHaveLength(2);
  });

  it('assigns a legal number to a wild card during the build step', () => {
    const match = drawCard(
      createMatch(players, { seed: 'wild', startingPlayerId: 'p1' }),
      'p1',
      'deck',
    );
    const prepared = {
      ...match,
      players: match.players.map((player) =>
        player.id === 'p1'
          ? { ...player, hand: [{ id: 'w', kind: 'wild' as const }] }
          : player,
      ),
    };

    const result = assignWildValue(prepared, 'p1', 'w', 8);
    expect(result.players[0].hand[0]).toMatchObject({ lockedValue: 8 });
  });

  it('lets a player who completed their phase extend a run', () => {
    const match = drawCard(
      createMatch(players, {
        seed: 'hit',
        startingPlayerId: 'p1',
        startingPhaseId: 3,
      }),
      'p1',
      'deck',
    );
    const runCards = [4, 5, 6, 7, 8].map((value) => ({
      id: `run-${value}`,
      kind: 'number' as const,
      value,
    }));
    const prepared = {
      ...match,
      players: match.players.map((player) =>
        player.id === 'p1'
          ? {
              ...player,
              completedPhase: true,
              hand: [{ id: 'nine', kind: 'number' as const, value: 9 }],
            }
          : {
              ...player,
              laidMelds: [
                {
                  id: 'run',
                  ownerId: 'p2',
                  phaseId: 3,
                  operation: 'run' as const,
                  cards: runCards,
                },
              ],
            },
      ),
    };

    const result = hitMeld(prepared, 'p1', 'p2', 'run', ['nine'], 'run');
    expect(result.players[0].hand).toHaveLength(0);
    expect(result.players[1].laidMelds[0].cards).toHaveLength(6);
    expect(result.status).toBe('round-ended');
  });

  it('adds a valid equation group to another completed phase', () => {
    const match = drawCard(
      createMatch(players, {
        seed: 'equation-hit',
        startingPlayerId: 'p1',
      }),
      'p1',
      'deck',
    );
    const prepared = {
      ...match,
      players: match.players.map((player) =>
        player.id === 'p1'
          ? {
              ...player,
              completedPhase: true,
              hand: [
                { id: 'three', kind: 'number' as const, value: 3 },
                { id: 'seven', kind: 'number' as const, value: 7 },
                { id: 'keep', kind: 'number' as const, value: 12 },
              ],
            }
          : {
              ...player,
              completedPhase: true,
              laidMelds: [
                {
                  id: 'sum-ten',
                  ownerId: 'p2',
                  phaseId: 1,
                  operation: 'add' as const,
                  cards: [
                    { id: 'four', kind: 'number' as const, value: 4 },
                    { id: 'six', kind: 'number' as const, value: 6 },
                  ],
                },
              ],
            },
      ),
    };

    const result = hitMeld(
      prepared,
      'p1',
      'p2',
      'sum-ten',
      ['three', 'seven'],
      'add',
    );

    expect(result.players[0].hand.map((card) => card.id)).toEqual(['keep']);
    expect(result.players[1].laidMelds).toHaveLength(2);
    expect(result.players[1].laidMelds[1].cards.map((card) => card.id)).toEqual([
      'three',
      'seven',
    ]);
    expect(result.status).toBe('playing');
  });

  it('lets a player add a valid group to their own completed phase', () => {
    const match = drawCard(
      createMatch(players, {
        seed: 'own-equation-hit',
        startingPlayerId: 'p1',
      }),
      'p1',
      'deck',
    );
    const prepared = {
      ...match,
      players: match.players.map((player) =>
        player.id === 'p1'
          ? {
              ...player,
              completedPhase: true,
              hand: [
                { id: 'one', kind: 'number' as const, value: 1 },
                { id: 'nine', kind: 'number' as const, value: 9 },
                { id: 'keep', kind: 'number' as const, value: 5 },
              ],
              laidMelds: [
                {
                  id: 'own-sum-ten',
                  ownerId: 'p1',
                  phaseId: 1,
                  operation: 'add' as const,
                  cards: [
                    { id: 'four', kind: 'number' as const, value: 4 },
                    { id: 'six', kind: 'number' as const, value: 6 },
                  ],
                },
              ],
            }
          : player,
      ),
    };

    const result = hitMeld(
      prepared,
      'p1',
      'p1',
      'own-sum-ten',
      ['one', 'nine'],
      'add',
    );

    expect(result.players[0].hand.map((card) => card.id)).toEqual(['keep']);
    expect(result.players[0].laidMelds).toHaveLength(2);
    expect(result.players[0].laidMelds[1].ownerId).toBe('p1');
  });

  it('rejects a hit that does not match the target player phase', () => {
    const match = drawCard(
      createMatch(players, {
        seed: 'invalid-equation-hit',
        startingPlayerId: 'p1',
      }),
      'p1',
      'deck',
    );
    const prepared = {
      ...match,
      players: match.players.map((player) =>
        player.id === 'p1'
          ? {
              ...player,
              completedPhase: true,
              hand: [
                { id: 'two', kind: 'number' as const, value: 2 },
                { id: 'three', kind: 'number' as const, value: 3 },
              ],
            }
          : {
              ...player,
              completedPhase: true,
              laidMelds: [
                {
                  id: 'sum-ten',
                  ownerId: 'p2',
                  phaseId: 1,
                  operation: 'add' as const,
                  cards: [
                    { id: 'four', kind: 'number' as const, value: 4 },
                    { id: 'six', kind: 'number' as const, value: 6 },
                  ],
                },
              ],
            },
      ),
    };

    expect(() =>
      hitMeld(prepared, 'p1', 'p2', 'sum-ten', ['two', 'three'], 'add'),
    ).toThrow('not 10');
  });
});
