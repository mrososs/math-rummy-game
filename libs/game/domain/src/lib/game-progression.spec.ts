import { describe, expect, it } from 'vitest';

import {
  createMatch,
  discardCard,
  drawCard,
  layPhase,
  startNextRound,
  type GameCard,
  type GameMatch,
} from './game-engine';

const players = [
  { id: 'p1', name: 'Maya', seat: 1 },
  { id: 'p2', name: 'Leo', seat: 2 },
];

function num(id: string, value: number): GameCard {
  return { id, kind: 'number', value };
}

/** Give p1 exactly the cards to lay phase 1 (two 2-card sums of 10) + go out. */
function withP1Hand(match: GameMatch, hand: GameCard[]): GameMatch {
  return {
    ...match,
    players: match.players.map((player) =>
      player.id === 'p1' ? { ...player, hand } : player,
    ),
  };
}

describe('game progression — round 1 completes and advances to phase 2', () => {
  it('plays draw -> lay phase 1 -> go out -> next round with no errors', () => {
    const started = createMatch(players, {
      seed: 'progression',
      startingPlayerId: 'p1',
      startingPhaseId: 1,
    });
    expect(started.players[0].phaseId).toBe(1);
    expect(started.status).toBe('playing');

    // p1 holds the four cards for two sums of 10.
    const prepared = withP1Hand(started, [
      num('a', 3),
      num('b', 7),
      num('c', 4),
      num('d', 6),
    ]);

    // Draw (turn step draw -> build), then lay both groups.
    const afterDraw = drawCard(prepared, 'p1', 'deck');
    expect(afterDraw.turnStep).toBe('build');
    expect(afterDraw.players[0].hand).toHaveLength(5);

    const afterLay = layPhase(afterDraw, 'p1', [
      { id: 'g1', cardIds: ['a', 'b'], operation: 'add' },
      { id: 'g2', cardIds: ['c', 'd'], operation: 'add' },
    ]);
    expect(afterLay.players[0].completedPhase).toBe(true);
    expect(afterLay.players[0].laidMelds).toHaveLength(2);
    expect(afterLay.players[0].hand).toHaveLength(1); // only the drawn card left

    // Discard the last card -> hand empty -> round ends (not phase 10, no winner).
    const lastCardId = afterLay.players[0].hand[0].id;
    const afterDiscard = discardCard(afterLay, 'p1', lastCardId);
    expect(afterDiscard.players[0].hand).toHaveLength(0);
    expect(afterDiscard.status).toBe('round-ended');
    expect(afterDiscard.winnerId).toBeUndefined();

    // Next round: p1 completed phase 1 -> phase 2; p2 did not -> still phase 1.
    const round2 = startNextRound(afterDiscard, 'progression-2');
    expect(round2.round).toBe(2);
    expect(round2.status).toBe('playing');
    const p1 = round2.players.find((p) => p.id === 'p1');
    const p2 = round2.players.find((p) => p.id === 'p2');
    expect(p1?.phaseId).toBe(2);
    expect(p2?.phaseId).toBe(1);
    // Fresh hands are dealt and phase-completion resets for the new round.
    expect(p1?.hand).toHaveLength(10);
    expect(p1?.completedPhase).toBe(false);
    expect(p1?.laidMelds).toHaveLength(0);
    // p1 kept phase 1's cards off-hand, so its running score reflects the round.
    expect(p1?.score).toBeGreaterThanOrEqual(0);
  });
});
