import {
  computed,
  onBeforeMount,
  onMounted,
  onUnmounted,
  watch,
  type ComputedRef,
} from 'vue';
import { storeToRefs } from 'pinia';
import type { DrawSource, GameMatch, MathOperation } from 'game-domain';
import type { GameCommand, WildAssignment } from 'network-contracts';
import { useGameStore } from 'game-state';
import { useRoomStore } from 'room-state';
import { useRoute } from 'vue-router';
import { useBotMatch } from './useBotMatch';
import { playSound } from './useSound';
import { useSettingsStore } from '../stores/use-settings-store';

/**
 * Owns all game-session synchronization for the game screen (F-06): hydration,
 * command submission, snapshot refresh, reconnect/resume, and pending-action
 * state. GameView is left to render and forward user interaction.
 *
 * Online mode dispatches validated commands and renders from authoritative
 * snapshots; bot/offline mode runs the engine locally and publishes the match.
 */
export function useGameSession(isBotMode: ComputedRef<boolean>) {
  const route = useRoute();
  const roomStore = useRoomStore();
  const gameStore = useGameStore();
  const settingsStore = useSettingsStore();
  const { thinkingBotId, thinkingBotName } = useBotMatch(isBotMode);
  const { gameState, playerSnapshot, room, currentPlayerId, commandPending } =
    storeToRefs(roomStore);
  const { match } = storeToRefs(gameStore);

  const isOnline = computed(() => roomStore.backendEnabled);
  // Online: lock state-changing controls while a command is in flight.
  const busy = computed(() => isOnline.value && commandPending.value);
  const winnerName = computed(() => {
    const currentMatch = match.value;
    if (!currentMatch?.winnerId) return undefined;
    return currentMatch.players.find(
      (player) => player.id === currentMatch.winnerId,
    )?.name;
  });

  onBeforeMount(() => {
    if (isBotMode.value && route.query.new === '1') {
      roomStore.setupBotRoom(settingsStore.playerName, settingsStore.botCount);
      gameStore.initializeGame(
        roomStore.room.players.map(({ id, name, seat }) => ({ id, name, seat })),
        roomStore.currentPlayerId,
        {
          seed: `bots-${Date.now()}`,
          phaseId: 1,
          useDemoHand: false,
          difficulty: settingsStore.botDifficulty,
        },
      );
      if (gameStore.match) void roomStore.publishGameState(gameStore.match);
      return;
    }
    if (isOnline.value) {
      if (playerSnapshot.value) {
        gameStore.hydrateFromSnapshot(playerSnapshot.value, currentPlayerId.value);
      } else {
        void roomStore.refreshSnapshot();
      }
      return;
    }
    if (isGameMatch(gameState.value)) {
      gameStore.hydrateGame(gameState.value, currentPlayerId.value);
      return;
    }
    if (match.value) return;
    gameStore.initializeGame(
      room.value.players.map(({ id, name, seat }) => ({ id, name, seat })),
      currentPlayerId.value,
      { seed: `room-${room.value.code}`, phaseId: 1, useDemoHand: false },
    );
  });

  // Online: re-render whenever the authoritative snapshot changes.
  watch(
    playerSnapshot,
    (snapshot) => {
      if (isOnline.value && snapshot) {
        gameStore.hydrateFromSnapshot(snapshot, currentPlayerId.value);
      }
    },
    { immediate: true },
  );

  // Offline/local: re-hydrate from a full match stored in gameState.
  watch(gameState, (nextState) => {
    if (isOnline.value) return;
    if (!isGameMatch(nextState) || nextState === match.value) return;
    gameStore.hydrateGame(nextState, currentPlayerId.value);
  });

  // Gameplay sound cues for state changes (button taps get their own sound).
  let soundInitialized = false;
  let prevStatus: string | undefined;
  let prevMyTurn = false;
  watch(match, (current) => {
    if (!current) {
      soundInitialized = false;
      prevStatus = undefined;
      prevMyTurn = false;
      return;
    }
    const active = current.players[current.activePlayerIndex];
    const myTurn =
      current.status === 'playing' && active?.id === currentPlayerId.value;
    if (!soundInitialized) {
      playSound('deal'); // entering / opening the game
      soundInitialized = true;
    } else if (current.status === 'match-ended' && prevStatus !== 'match-ended') {
      playSound('win');
    } else if (current.status === 'round-ended' && prevStatus !== 'round-ended') {
      playSound('roundEnd');
    } else if (myTurn && !prevMyTurn) {
      playSound('turn');
    }
    prevStatus = current.status;
    prevMyTurn = myTurn;
  });

  // Online: refetch the authoritative snapshot on app resume, tab focus, or
  // network reconnect, covering missed Realtime events / version gaps.
  function resyncIfOnline(): void {
    if (isOnline.value && !document.hidden) void roomStore.refreshSnapshot();
  }
  // Polling fallback: Realtime can drop on mobile (backgrounded sockets), which
  // left round transitions stuck until a manual reload. A steady refetch heals
  // that; the version guard in the store makes unchanged snapshots a no-op, so
  // this never disturbs an in-progress selection.
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  onMounted(() => {
    document.addEventListener('visibilitychange', resyncIfOnline);
    window.addEventListener('focus', resyncIfOnline);
    window.addEventListener('online', resyncIfOnline);
    if (isOnline.value) {
      pollTimer = setInterval(() => {
        if (!roomStore.commandPending && !document.hidden) {
          void roomStore.refreshSnapshot();
        }
      }, 5000);
    }
  });
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', resyncIfOnline);
    window.removeEventListener('focus', resyncIfOnline);
    window.removeEventListener('online', resyncIfOnline);
    if (pollTimer) clearInterval(pollTimer);
  });

  // Offline: run the engine locally, then publish the full match.
  async function syncAction(action: () => void): Promise<void> {
    const previousMatch = match.value;
    action();
    if (match.value && match.value !== previousMatch) {
      await roomStore.publishGameState(match.value);
    }
  }

  // Online: send a command; the room store queues (FIFO) and toggles the lock,
  // and the authoritative snapshot drives the UI.
  async function dispatch(command: GameCommand): Promise<void> {
    await roomStore.sendCommand(command);
  }

  function newActionId(): string {
    return (
      globalThis.crypto?.randomUUID?.() ?? `act-${Date.now()}-${Math.random()}`
    );
  }

  function wildValuesFor(cardIds: readonly string[]): WildAssignment[] {
    const draft = gameStore.wildDraft;
    return cardIds
      .filter((id) => draft[id] != null)
      .map((id) => ({ cardId: id, value: draft[id] }));
  }

  function draw(source: DrawSource): void {
    if (isOnline.value) {
      void dispatch({ actionId: newActionId(), type: 'DRAW_CARD', source });
    } else {
      void syncAction(() => gameStore.draw(source));
    }
  }

  function submitPhase(): void {
    if (isOnline.value) {
      const melds = gameStore.stagedMelds.map((meld) => ({
        id: meld.id,
        cardIds: [...meld.cardIds],
        operation: meld.operation,
      }));
      const cardIds = melds.flatMap((meld) => meld.cardIds);
      void dispatch({
        actionId: newActionId(),
        type: 'LAY_PHASE',
        melds,
        wildValues: wildValuesFor(cardIds),
      });
    } else {
      void syncAction(() => gameStore.submitPhase());
    }
  }

  function setWildValue(cardId: string, value: number): void {
    if (isOnline.value) {
      gameStore.setWildDraft(cardId, value);
    } else {
      void syncAction(() => gameStore.setWildValue(cardId, value));
    }
  }

  function hitSelectedCards(targetPlayerId: string, meldId: string): void {
    if (isOnline.value) {
      const cardIds = [...gameStore.selectedCardIds];
      void dispatch({
        actionId: newActionId(),
        type: 'HIT_MELD',
        targetPlayerId,
        meldId,
        cardIds,
        operation: gameStore.selectedOperation,
        wildValues: wildValuesFor(cardIds),
      });
    } else {
      void syncAction(() => gameStore.hitSelectedCards(targetPlayerId, meldId));
    }
  }

  function discardSelected(): void {
    if (isOnline.value) {
      const cardId = gameStore.selectedCardIds[0];
      if (!cardId) return;
      void dispatch({ actionId: newActionId(), type: 'DISCARD_CARD', cardId });
    } else {
      void syncAction(() => gameStore.discardSelected());
    }
  }

  function beginNextRound(): void {
    if (isOnline.value) {
      void dispatch({ actionId: newActionId(), type: 'NEXT_ROUND' });
    } else {
      void syncAction(() =>
        gameStore.beginNextRound(`round-${Date.now().toString(36)}`),
      );
    }
  }

  function setOperation(operation: MathOperation): void {
    gameStore.setOperation(operation);
  }

  return {
    busy,
    winnerName,
    thinkingBotId,
    thinkingBotName,
    draw,
    submitPhase,
    setOperation,
    setWildValue,
    hitSelectedCards,
    discardSelected,
    beginNextRound,
  };
}

function isGameMatch(value: unknown): value is GameMatch {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GameMatch>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.round === 'number' &&
    Array.isArray(candidate.players) &&
    Array.isArray(candidate.deck) &&
    Array.isArray(candidate.discardPile) &&
    (candidate.status === 'playing' ||
      candidate.status === 'round-ended' ||
      candidate.status === 'match-ended') &&
    (candidate.turnStep === 'draw' || candidate.turnStep === 'build')
  );
}
