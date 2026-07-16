import { computed, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import {
  DEMO_HAND,
  GameRuleError,
  activePlayer,
  assignWildValue,
  createMatch,
  discardCard,
  drawCard,
  getPhase,
  hitMeld,
  layPhase,
  playBotTurn as runBotEngineTurn,
  startNextRound,
  validateMeldForPhase,
  validatePhase,
  type DrawSource,
  type EngineMeldInput,
  type GameCard,
  type GameMatch,
  type MatchPlayerInput,
  type MathOperation,
  type BotDifficulty,
} from 'game-domain';
import type { PlayerGameSnapshot } from 'network-contracts';

export type GameTransportMode = 'local' | 'online';

/**
 * Rebuilds a renderable GameMatch from a sanitized server snapshot. Opponent
 * hands and the deck are placeholder cards (only their counts are shown); the
 * viewer's own hand is real, with any drafted wild values applied so local
 * validation matches what will be sent to the server.
 */
function snapshotToMatch(
  snapshot: PlayerGameSnapshot,
  wildDraft: Record<string, number>,
): GameMatch {
  const placeholders = (count: number, prefix: string): GameCard[] =>
    Array.from({ length: Math.max(0, count) }, (_, index) => ({
      id: `${prefix}-${index}`,
      kind: 'number' as const,
      value: 0,
    }));

  const players = snapshot.players.map((player) => ({
    id: player.id,
    name: player.name,
    seat: player.seat,
    phaseId: player.phaseId,
    score: player.score,
    completedPhase: player.completedPhase,
    laidMelds: player.laidMelds,
    hand:
      player.id === snapshot.viewerId
        ? snapshot.myHand.map((card) =>
            card.kind === 'wild' && wildDraft[card.id] != null
              ? { ...card, lockedValue: wildDraft[card.id] }
              : card,
          )
        : placeholders(player.cardCount, `hidden-${player.id}`),
  }));

  const discardPile = snapshot.discardTop
    ? [
        ...placeholders(snapshot.discardCount - 1, 'discard-hidden'),
        snapshot.discardTop,
      ]
    : [];

  return {
    id: snapshot.gameId,
    round: snapshot.round,
    status: snapshot.status,
    players,
    activePlayerIndex: snapshot.activePlayerIndex,
    turnStep: snapshot.turnStep,
    deck: placeholders(snapshot.deckCount, 'deck-hidden'),
    discardPile,
    actionLog: snapshot.actionLog,
    winnerId: snapshot.winnerId ?? undefined,
  };
}

export interface InitializeGameOptions {
  seed?: string;
  phaseId?: number;
  useDemoHand?: boolean;
}

export const useGameStore = defineStore('game-match', () => {
  const match = shallowRef<GameMatch | null>(null);
  const currentPlayerId = shallowRef('');
  const selectedCardIds = shallowRef<string[]>([]);
  const stagedMelds = shallowRef<EngineMeldInput[]>([]);
  const selectedOperation = shallowRef<MathOperation>('add');
  const feedbackMessage = shallowRef('Draw a card to begin your turn.');
  // Online mode: the view renders from an authoritative server snapshot and
  // dispatches commands instead of mutating the match locally.
  const transportMode = shallowRef<GameTransportMode>('local');
  const currentSnapshot = shallowRef<PlayerGameSnapshot | null>(null);
  const wildDraft = shallowRef<Record<string, number>>({});
  const pendingCommand = shallowRef(false);

  const currentPlayer = computed(() =>
    match.value?.players.find((player) => player.id === currentPlayerId.value),
  );
  const currentPhase = computed(() =>
    getPhase(currentPlayer.value?.phaseId ?? 1),
  );
  const currentHand = computed(() => currentPlayer.value?.hand ?? []);
  const activePlayerState = computed(() =>
    match.value ? activePlayer(match.value) : undefined,
  );
  const isCurrentPlayersTurn = computed(
    () => activePlayerState.value?.id === currentPlayerId.value,
  );
  const selectedCards = computed(() =>
    selectedCardIds.value
      .map((cardId) => currentHand.value.find((card) => card.id === cardId))
      .filter((card): card is GameCard => Boolean(card)),
  );
  const stagedCardIds = computed(() =>
    stagedMelds.value.flatMap((meld) => [...meld.cardIds]),
  );
  const stagedCardIdSet = computed(() => new Set(stagedCardIds.value));
  const stagedMeldDetails = computed(() =>
    stagedMelds.value.map((meld) => ({
      ...meld,
      cards: meld.cardIds
        .map((cardId) => currentHand.value.find((card) => card.id === cardId))
        .filter((card): card is GameCard => Boolean(card)),
    })),
  );
  const candidateValidation = computed(() =>
    validateMeldForPhase(
      currentPhase.value.id,
      selectedCards.value,
      selectedOperation.value,
    ),
  );
  const phaseValidation = computed(() =>
    validatePhase(currentPhase.value.id, stagedMeldDetails.value),
  );
  const canDraw = computed(
    () =>
      match.value?.status === 'playing' &&
      match.value.turnStep === 'draw' &&
      isCurrentPlayersTurn.value,
  );
  const canSelectCards = computed(
    () =>
      match.value?.status === 'playing' &&
      match.value.turnStep === 'build' &&
      isCurrentPlayersTurn.value,
  );
  const canStageMeld = computed(
    () =>
      canSelectCards.value &&
      selectedCards.value.length > 0 &&
      candidateValidation.value.valid,
  );
  const canSubmitPhase = computed(
    () =>
      canSelectCards.value &&
      !currentPlayer.value?.completedPhase &&
      phaseValidation.value.valid,
  );
  const canDiscard = computed(
    () =>
      canSelectCards.value &&
      selectedCardIds.value.length === 1 &&
      !stagedCardIdSet.value.has(selectedCardIds.value[0]),
  );
  const canHit = computed(
    () =>
      canSelectCards.value &&
      Boolean(currentPlayer.value?.completedPhase) &&
      selectedCardIds.value.length > 0 &&
      selectedCardIds.value.every(
        (cardId) => !stagedCardIdSet.value.has(cardId),
      ),
  );
  const discardTop = computed(() => {
    const pile = match.value?.discardPile;
    return pile?.[pile.length - 1];
  });
  const lastAction = computed(() => {
    const log = match.value?.actionLog;
    return log?.[log.length - 1];
  });

  function initializeGame(
    players: readonly MatchPlayerInput[],
    localPlayerId: string,
    options: InitializeGameOptions = {},
  ): void {
    const phaseId = options.phaseId ?? 1;
    const created = createMatch(players, {
      seed: options.seed ?? 'room-K4P9',
      startingPlayerId: localPlayerId,
      startingPhaseId: phaseId,
    });
    match.value =
      options.useDemoHand === true
        ? {
            ...created,
            players: created.players.map((player) =>
              player.id === localPlayerId
                ? { ...player, hand: [...DEMO_HAND], phaseId }
                : player,
            ),
          }
        : created;
    currentPlayerId.value = localPlayerId;
    transportMode.value = 'local';
    currentSnapshot.value = null;
    wildDraft.value = {};
    selectedCardIds.value = [];
    stagedMelds.value = [];
    selectedOperation.value = 'add';
    feedbackMessage.value = 'Your turn · draw from either pile.';
  }

  function hydrateGame(nextMatch: GameMatch, localPlayerId: string): void {
    match.value = nextMatch;
    currentPlayerId.value = localPlayerId;
    transportMode.value = 'local';
    currentSnapshot.value = null;
    wildDraft.value = {};
    selectedCardIds.value = [];
    stagedMelds.value = [];
    selectedOperation.value = 'add';
    feedbackMessage.value =
      activePlayer(nextMatch).id === localPlayerId
        ? nextMatch.turnStep === 'draw'
          ? 'Your turn - draw from either pile.'
          : 'Build your phase, hit the table, or discard.'
        : `Waiting for ${activePlayer(nextMatch).name}.`;
  }

  /** Online: render from an authoritative server snapshot. */
  function hydrateFromSnapshot(
    snapshot: PlayerGameSnapshot,
    localPlayerId: string,
  ): void {
    transportMode.value = 'online';
    currentSnapshot.value = snapshot;
    currentPlayerId.value = localPlayerId;
    wildDraft.value = {};
    selectedCardIds.value = [];
    stagedMelds.value = [];
    selectedOperation.value = 'add';
    match.value = snapshotToMatch(snapshot, {});
    const active = snapshot.players[snapshot.activePlayerIndex];
    feedbackMessage.value =
      snapshot.status !== 'playing'
        ? 'Round complete.'
        : active?.id === localPlayerId
          ? snapshot.turnStep === 'draw'
            ? 'Your turn - draw from either pile.'
            : 'Build your phase, hit the table, or discard.'
          : `Waiting for ${active?.name ?? 'the next player'}.`;
  }

  /** Online: draft a wild value locally; sent with the next lay/hit command. */
  function setWildDraft(cardId: string, value: number): void {
    wildDraft.value = { ...wildDraft.value, [cardId]: value };
    if (currentSnapshot.value) {
      match.value = snapshotToMatch(currentSnapshot.value, wildDraft.value);
    }
    feedbackMessage.value = `Wild card set to ${value}.`;
  }

  function setPendingCommand(pending: boolean): void {
    pendingCommand.value = pending;
  }

  function toggleCard(cardId: string): void {
    if (!canSelectCards.value || stagedCardIdSet.value.has(cardId)) return;
    selectedCardIds.value = selectedCardIds.value.includes(cardId)
      ? selectedCardIds.value.filter((id) => id !== cardId)
      : [...selectedCardIds.value, cardId];
  }

  function setOperation(operation: MathOperation): void {
    selectedOperation.value = operation;
  }

  function draw(source: DrawSource): void {
    runEngineAction(() => {
      match.value = drawCard(requireMatch(), currentPlayerId.value, source);
      selectedCardIds.value = [];
      feedbackMessage.value =
        'Build your phase, hit the table, or select one card to discard.';
    });
  }

  function stageSelectedMeld(): void {
    if (!candidateValidation.value.valid) {
      feedbackMessage.value = candidateValidation.value.message;
      return;
    }
    stagedMelds.value = [
      ...stagedMelds.value,
      {
        id: `meld-${currentPhase.value.id}-${stagedMelds.value.length + 1}`,
        cardIds: [...selectedCardIds.value],
        operation: selectedOperation.value,
      },
    ];
    selectedCardIds.value = [];
    feedbackMessage.value = phaseValidation.value.valid
      ? 'All groups are ready. Submit your phase.'
      : `Group ${stagedMelds.value.length} staged.`;
  }

  function removeStagedMeld(meldId: string): void {
    stagedMelds.value = stagedMelds.value.filter((meld) => meld.id !== meldId);
    feedbackMessage.value = 'Group returned to your hand.';
  }

  function submitPhase(): void {
    runEngineAction(() => {
      match.value = layPhase(
        requireMatch(),
        currentPlayerId.value,
        stagedMelds.value,
      );
      selectedCardIds.value = [];
      stagedMelds.value = [];
      feedbackMessage.value = `${currentPhase.value.shortTitle} completed · select cards and tap any compatible phase on the table.`;
    });
  }

  function setWildValue(cardId: string, value: number): void {
    runEngineAction(() => {
      match.value = assignWildValue(
        requireMatch(),
        currentPlayerId.value,
        cardId,
        value,
      );
      feedbackMessage.value = `Wild card set to ${value}.`;
    });
  }

  function hitSelectedCards(targetPlayerId: string, meldId: string): void {
    if (!canHit.value) {
      feedbackMessage.value =
        'Complete your phase, then select cards to hit the table.';
      return;
    }
    runEngineAction(() => {
      match.value = hitMeld(
        requireMatch(),
        currentPlayerId.value,
        targetPlayerId,
        meldId,
        selectedCardIds.value,
        selectedOperation.value,
      );
      selectedCardIds.value = [];
      feedbackMessage.value =
        match.value.status === 'playing'
          ? 'Valid hit · keep hitting or select one card to discard.'
          : 'You went out · round complete.';
    });
  }

  function discardSelected(): void {
    if (!canDiscard.value) {
      feedbackMessage.value = 'Select exactly one unstaged card to discard.';
      return;
    }
    runEngineAction(() => {
      match.value = discardCard(
        requireMatch(),
        currentPlayerId.value,
        selectedCardIds.value[0],
      );
      selectedCardIds.value = [];
      stagedMelds.value = [];
      feedbackMessage.value =
        match.value.status === 'playing'
          ? `Waiting for ${activePlayer(match.value).name}.`
          : 'Round complete.';
    });
  }

  function clearSelection(): void {
    selectedCardIds.value = [];
  }

  function playBotTurn(
    botId: string,
    difficulty: BotDifficulty = 'standard',
  ): void {
    runEngineAction(() => {
      match.value = runBotEngineTurn(requireMatch(), botId, { difficulty });
      selectedCardIds.value = [];
      stagedMelds.value = [];
      feedbackMessage.value =
        match.value.status === 'playing'
          ? activePlayer(match.value).id === currentPlayerId.value
            ? 'Your turn - draw from either pile.'
            : `Waiting for ${activePlayer(match.value).name}.`
          : 'Round complete.';
    });
  }

  function beginNextRound(seed?: string): void {
    runEngineAction(() => {
      match.value = startNextRound(requireMatch(), seed);
      selectedCardIds.value = [];
      stagedMelds.value = [];
      selectedOperation.value = 'add';
      feedbackMessage.value =
        activePlayer(match.value).id === currentPlayerId.value
          ? 'New round - draw from either pile.'
          : `Waiting for ${activePlayer(match.value).name}.`;
    });
  }

  function runEngineAction(action: () => void): void {
    try {
      action();
    } catch (error) {
      feedbackMessage.value =
        error instanceof GameRuleError
          ? error.message
          : 'The game state could not be updated.';
    }
  }

  function requireMatch(): GameMatch {
    if (!match.value)
      throw new Error('Initialize the match before using the game store.');
    return match.value;
  }

  return {
    match,
    currentPlayerId,
    selectedCardIds,
    stagedMelds,
    selectedOperation,
    feedbackMessage,
    transportMode,
    currentSnapshot,
    wildDraft,
    pendingCommand,
    currentPlayer,
    currentPhase,
    currentHand,
    activePlayerState,
    isCurrentPlayersTurn,
    selectedCards,
    stagedCardIds,
    stagedMeldDetails,
    candidateValidation,
    phaseValidation,
    canDraw,
    canSelectCards,
    canStageMeld,
    canSubmitPhase,
    canDiscard,
    canHit,
    discardTop,
    lastAction,
    initializeGame,
    hydrateGame,
    hydrateFromSnapshot,
    setWildDraft,
    setPendingCommand,
    toggleCard,
    setOperation,
    draw,
    stageSelectedMeld,
    removeStagedMeld,
    submitPhase,
    setWildValue,
    hitSelectedCards,
    discardSelected,
    clearSelection,
    playBotTurn,
    beginNextRound,
  };
});
