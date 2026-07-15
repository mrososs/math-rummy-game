import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useGameStore } from './use-game-store';

const players = [
  { id: 'p1', name: 'Maya', seat: 1 },
  { id: 'p2', name: 'Leo', seat: 2 },
];

describe('game store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('moves the local player from draw to build state', () => {
    const store = useGameStore();
    store.initializeGame(players, 'p1', { phaseId: 2, useDemoHand: true });

    expect(store.canDraw).toBe(true);
    store.draw('deck');

    expect(store.canDraw).toBe(false);
    expect(store.canSelectCards).toBe(true);
    expect(store.currentHand).toHaveLength(11);
  });

  it('stages and submits two valid equations for phase two', () => {
    const store = useGameStore();
    store.initializeGame(players, 'p1', { phaseId: 2, useDemoHand: true });
    store.draw('deck');

    store.toggleCard('demo-3-a');
    store.toggleCard('demo-9');
    store.stageSelectedMeld();
    store.toggleCard('demo-5');
    store.toggleCard('demo-7');
    store.stageSelectedMeld();

    expect(store.canSubmitPhase).toBe(true);
    store.submitPhase();
    expect(store.currentPlayer?.completedPhase).toBe(true);
    expect(store.currentPlayer?.laidMelds).toHaveLength(2);
  });

  it('hits the local completed phase with a selected valid group', () => {
    const store = useGameStore();
    store.initializeGame(players, 'p1', { phaseId: 2, useDemoHand: true });
    store.draw('deck');

    store.toggleCard('demo-3-a');
    store.toggleCard('demo-9');
    store.stageSelectedMeld();
    store.toggleCard('demo-5');
    store.toggleCard('demo-7');
    store.stageSelectedMeld();
    store.submitPhase();

    const targetMeldId = store.currentPlayer?.laidMelds[0]?.id;
    expect(targetMeldId).toBeTruthy();
    store.setOperation('multiply');
    store.toggleCard('demo-2');
    store.toggleCard('demo-6');

    expect(store.canHit).toBe(true);
    store.hitSelectedCards('p1', targetMeldId ?? 'missing');

    expect(store.currentPlayer?.laidMelds).toHaveLength(3);
    expect(store.currentHand.map((card) => card.id)).not.toContain('demo-2');
    expect(store.currentHand.map((card) => card.id)).not.toContain('demo-6');
  });
});
