import { describe, expect, it } from 'vitest';

import { getPhase } from './game-domain';
import {
  assignWildValue,
  createMatch,
  discardCard,
  drawCard,
  layPhase,
  type GameCard,
  type GameMatch,
  type MatchPlayerState,
} from './game-engine';

const players = [
  { id: 'p1', name: 'Maya', seat: 1 },
  { id: 'p2', name: 'Leo', seat: 2 },
];

function num(id: string, value: number): GameCard {
  return { id, kind: 'number', value };
}

/** A minimal playing match with p1 active on the given turn step. */
function craft(
  p1: Partial<MatchPlayerState>,
  overrides: Partial<GameMatch> = {},
): GameMatch {
  const base = createMatch(players, { seed: 'edge', startingPlayerId: 'p1' });
  return {
    ...base,
    turnStep: 'build',
    players: base.players.map((player) =>
      player.id === 'p1' ? { ...player, ...p1 } : player,
    ),
    ...overrides,
  };
}

describe('game engine — turn and ownership guards', () => {
  it('rejects a draw from a player whose turn it is not', () => {
    const match = createMatch(players, { seed: 'wrong-turn', startingPlayerId: 'p1' });
    expect(() => drawCard(match, 'p2', 'deck')).toThrowError(/wait for your turn/i);
  });

  it('rejects drawing twice (wrong turn step)', () => {
    const match = drawCard(
      createMatch(players, { seed: 'double-draw', startingPlayerId: 'p1' }),
      'p1',
      'deck',
    );
    expect(() => drawCard(match, 'p1', 'deck')).toThrowError(/already drawn/i);
  });

  it('rejects discarding a card the player does not hold', () => {
    const match = craft({ hand: [num('keep', 5)] });
    expect(() => discardCard(match, 'p1', 'not-mine')).toThrowError(
      /no longer in your hand/i,
    );
  });

  it('rejects laying a phase that is already complete', () => {
    const match = craft({
      completedPhase: true,
      hand: [num('a', 3), num('b', 7)],
    });
    expect(() =>
      layPhase(match, 'p1', [{ id: 'm', cardIds: ['a', 'b'], operation: 'add' }]),
    ).toThrowError(/already on the table/i);
  });
});

describe('game engine — wild cards', () => {
  it('rejects an out-of-range wild value', () => {
    const match = craft({ hand: [{ id: 'w', kind: 'wild' }] });
    expect(() => assignWildValue(match, 'p1', 'w', 13)).toThrowError(/between 1 and 12/i);
    expect(() => assignWildValue(match, 'p1', 'w', 0)).toThrowError(/between 1 and 12/i);
  });

  it('rejects assigning a value to a non-wild card', () => {
    const match = craft({ hand: [num('n', 4)] });
    expect(() => assignWildValue(match, 'p1', 'n', 6)).toThrowError(
      /only wild cards/i,
    );
  });
});

describe('game engine — round and match completion', () => {
  it('ends the round when a player discards their last card (below phase 10)', () => {
    const match = craft({ phaseId: 3, completedPhase: false, hand: [num('last', 8)] });
    const result = discardCard(match, 'p1', 'last');
    expect(result.players[0].hand).toHaveLength(0);
    expect(result.status).toBe('round-ended');
    expect(result.winnerId).toBeUndefined();
  });

  it('ends the match when a phase-10 player goes out', () => {
    const match = craft({ phaseId: 10, completedPhase: true, hand: [num('last', 8)] });
    const result = discardCard(match, 'p1', 'last');
    expect(result.status).toBe('match-ended');
    expect(result.winnerId).toBe('p1');
  });
});

describe('game engine — deck recycling', () => {
  it('recycles the discard pile when the deck is empty', () => {
    const match = craft(
      { hand: [num('h', 2)] },
      {
        turnStep: 'draw',
        deck: [],
        discardPile: [num('d1', 4), num('d2', 6), num('d3', 9)],
      },
    );
    const result = drawCard(match, 'p1', 'deck');
    // The top discard stays; the rest become the new deck, minus the drawn card.
    expect(result.players[0].hand).toHaveLength(2);
    expect(result.discardPile).toHaveLength(1);
    expect(result.deck.length + result.discardPile.length).toBe(2);
    expect(result.turnStep).toBe('build');
  });
});

describe('game engine — difficulty phase sets', () => {
  it('resolves different phase-1 goals per difficulty', () => {
    const easy = getPhase(1, 'easy');
    const standard = getPhase(1, 'standard');
    const clever = getPhase(1, 'clever');
    expect(easy.shortTitle).not.toBe(standard.shortTitle);
    expect(clever.shortTitle).not.toBe(standard.shortTitle);
    // Easy phase 1 is two 2-card sums of 8.
    expect(easy.requirements[0]).toMatchObject({ target: 8, cardCount: 2 });
  });

  it('a clever match requires 3-card equations at phase 2', () => {
    const match = craft(
      { phaseId: 2, hand: [num('a', 5), num('b', 6), num('c', 7), num('d', 9)] },
      { difficulty: 'clever' },
    );
    // Two-card equation is rejected (clever phase 2 needs 3-card equations = 18).
    expect(() =>
      layPhase(match, 'p1', [
        { id: 'g1', cardIds: ['a', 'b'], operation: 'add' },
        { id: 'g2', cardIds: ['c', 'd'], operation: 'add' },
      ]),
    ).toThrowError();
  });

  it('a clever match accepts two 3-card equations = 18', () => {
    const match = craft(
      {
        phaseId: 2,
        hand: [
          num('a', 5),
          num('b', 6),
          num('c', 7),
          num('d', 6),
          num('e', 6),
          num('f', 6),
        ],
      },
      { difficulty: 'clever' },
    );
    const result = layPhase(match, 'p1', [
      { id: 'g1', cardIds: ['a', 'b', 'c'], operation: 'add' }, // 5+6+7 = 18
      { id: 'g2', cardIds: ['d', 'e', 'f'], operation: 'add' }, // 6+6+6 = 18
    ]);
    expect(result.players[0].completedPhase).toBe(true);
  });
});

describe('game engine — multi-card equations', () => {
  it('accepts an equation built from three cards', () => {
    const match = craft({
      phaseId: 2, // two equations that equal 12
      hand: [num('a', 3), num('b', 4), num('c', 5), num('d', 5), num('e', 7)],
    });
    const result = layPhase(match, 'p1', [
      { id: 'g1', cardIds: ['a', 'b', 'c'], operation: 'add' }, // 3+4+5 = 12
      { id: 'g2', cardIds: ['d', 'e'], operation: 'add' }, // 5+7 = 12
    ]);
    expect(result.players[0].completedPhase).toBe(true);
    expect(result.players[0].laidMelds[0].cards).toHaveLength(3);
  });

  it('rejects a multi-card equation that misses the target', () => {
    const match = craft({
      phaseId: 2,
      hand: [num('a', 3), num('b', 4), num('c', 4), num('d', 5), num('e', 7)],
    });
    expect(() =>
      layPhase(match, 'p1', [
        { id: 'g1', cardIds: ['a', 'b', 'c'], operation: 'add' }, // 3+4+4 = 11 ≠ 12
        { id: 'g2', cardIds: ['d', 'e'], operation: 'add' },
      ]),
    ).toThrowError();
  });
});

describe('game engine — duplicate card protection', () => {
  it('rejects a phase that reuses the same card in two groups', () => {
    const match = craft({
      phaseId: 1,
      hand: [num('a', 3), num('b', 7), num('c', 4)],
    });
    expect(() =>
      layPhase(match, 'p1', [
        { id: 'm1', cardIds: ['a', 'b'], operation: 'add' },
        { id: 'm2', cardIds: ['a', 'c'], operation: 'add' },
      ]),
    ).toThrowError();
  });
});
