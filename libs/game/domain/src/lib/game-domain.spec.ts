import { describe, expect, it } from 'vitest';

import {
  cardValue,
  createDeck,
  getPhase,
  scoreHand,
  validatePhase,
  type GameCard,
} from './game-domain';

let cardSequence = 0;
const numbers = (...values: number[]): GameCard[] =>
  values.map((value, index) => ({
    id: `${value}-${index}-${cardSequence++}`,
    kind: 'number',
    value,
  }));

describe('game domain', () => {
  it('returns the requested progressive phase', () => {
    expect(getPhase(3).example).toEqual([4, 5, 6, 7, 8]);
  });

  it('keeps an unlocked wild card value private', () => {
    expect(cardValue({ id: 'wild', kind: 'wild' })).toBeUndefined();
  });

  it('validates the two phase-two equations regardless of requirement order', () => {
    expect(
      validatePhase(2, [
        { cards: numbers(3, 9), operation: 'add' },
        { cards: numbers(3, 4), operation: 'multiply' },
      ]),
    ).toEqual({ valid: true, message: 'Phase 2 is complete.' });
  });

  it('rejects duplicate operations when a phase requires different methods', () => {
    expect(
      validatePhase(7, [
        { cards: numbers(12, 12), operation: 'add' },
        { cards: numbers(11, 13), operation: 'add' },
      ]).valid,
    ).toBe(false);
  });

  it('builds a deterministic 104-card deck suitable for eight players', () => {
    const first = createDeck({ seed: 'room' });
    const second = createDeck({ seed: 'room' });
    expect(first).toHaveLength(104);
    expect(first).toEqual(second);
  });

  it('scores wild cards as 25 points', () => {
    expect(scoreHand([...numbers(3, 12), { id: 'w', kind: 'wild' }])).toBe(40);
  });
});
