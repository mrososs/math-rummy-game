import { describe, expect, it } from 'vitest';

import { findBotPhasePlan, playBotTurn } from './bot-player';
import { createMatch, drawCard } from './game-engine';

const players = [
  { id: 'human', name: 'Maya', seat: 1 },
  { id: 'bot-1', name: 'Nova', seat: 2 },
];

describe('bot player', () => {
  it('finds and lays two sums of ten', () => {
    const match = drawCard(
      createMatch(players, { seed: 'bot-phase', startingPlayerId: 'bot-1' }),
      'bot-1',
      'deck',
    );
    const prepared = {
      ...match,
      players: match.players.map((player) =>
        player.id === 'bot-1'
          ? {
              ...player,
              hand: [
                { id: 'three', kind: 'number' as const, value: 3 },
                { id: 'seven', kind: 'number' as const, value: 7 },
                { id: 'four', kind: 'number' as const, value: 4 },
                { id: 'six', kind: 'number' as const, value: 6 },
                { id: 'keep', kind: 'number' as const, value: 12 },
              ],
            }
          : player,
      ),
    };

    const plan = findBotPhasePlan(prepared.players[1]);
    expect(plan?.melds).toHaveLength(2);

    const result = playBotTurn({ ...prepared, turnStep: 'draw' }, 'bot-1', {
      difficulty: 'clever',
    });
    expect(result.players[1].completedPhase).toBe(true);
    expect(result.players[result.activePlayerIndex].id).toBe('human');
  });

  it('draws and discards to pass the turn when no phase is available', () => {
    const match = createMatch(players, {
      seed: 'bot-simple-turn',
      startingPlayerId: 'bot-1',
    });
    const result = playBotTurn(match, 'bot-1');

    expect(result.turnStep).toBe('draw');
    expect(result.players[result.activePlayerIndex].id).toBe('human');
    expect(result.actionLog.at(-1)?.playerId).toBe('bot-1');
  });
});
