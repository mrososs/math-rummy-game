// AUTO-MIRRORED from libs/game/domain/src/lib — do not edit here.
// Kept in sync for the Deno Edge Function runtime (see functions/_shared/README.md).
// The engine is pure and framework-free, so this is a byte-for-byte copy except
// for the explicit .ts import extension Deno requires.

import {
  createDeck,
  getPhase,
  scoreHand,
  validateMeld,
  validatePhase,
  type CardId,
  type GameCard,
  type MathOperation,
  type MeldRequirement,
  type PhaseDifficulty,
  type ValidationResult,
} from './game-domain.ts';

export type MatchStatus = 'playing' | 'round-ended' | 'match-ended';
export type TurnStep = 'draw' | 'build';
export type DrawSource = 'deck' | 'discard';

export interface MatchPlayerInput {
  id: string;
  name: string;
  seat: number;
}

export interface LaidMeld {
  id: string;
  ownerId: string;
  phaseId: number;
  operation: MathOperation;
  cards: readonly GameCard[];
}

export interface MatchPlayerState extends MatchPlayerInput {
  phaseId: number;
  score: number;
  hand: readonly GameCard[];
  laidMelds: readonly LaidMeld[];
  completedPhase: boolean;
}

export interface GameActionLog {
  id: string;
  playerId: string;
  message: string;
}

export interface GameMatch {
  id: string;
  round: number;
  status: MatchStatus;
  players: readonly MatchPlayerState[];
  activePlayerIndex: number;
  turnStep: TurnStep;
  deck: readonly GameCard[];
  discardPile: readonly GameCard[];
  actionLog: readonly GameActionLog[];
  winnerId?: string;
  /** Which phase set this match uses. Undefined behaves as 'standard'. */
  difficulty?: PhaseDifficulty;
}

export interface EngineMeldInput {
  id: string;
  cardIds: readonly CardId[];
  operation: MathOperation;
}

export interface HitValidationResult extends ValidationResult {
  mode?: 'extend-run' | 'add-group';
}

export class GameRuleError extends Error {
  constructor(
    readonly code:
      | 'NOT_PLAYING'
      | 'NOT_YOUR_TURN'
      | 'WRONG_TURN_STEP'
      | 'CARD_NOT_FOUND'
      | 'INVALID_PHASE'
      | 'PHASE_ALREADY_COMPLETE'
      | 'HIT_NOT_ALLOWED',
    message: string,
  ) {
    super(message);
    this.name = 'GameRuleError';
  }
}

export function createMatch(
  players: readonly MatchPlayerInput[],
  options: {
    seed?: string;
    handSize?: number;
    startingPlayerId?: string;
    startingPhaseId?: number;
    difficulty?: PhaseDifficulty;
  } = {},
): GameMatch {
  if (players.length < 2 || players.length > 8) {
    throw new Error('A match needs between 2 and 8 players.');
  }
  const { seed = 'room-K4P9', handSize = 10, startingPhaseId = 1 } = options;
  const deck = createDeck({ seed });
  const hands = players.map(() => [] as GameCard[]);
  for (let cardIndex = 0; cardIndex < handSize; cardIndex += 1) {
    players.forEach((_player, playerIndex) => {
      const card = deck.pop();
      if (card) hands[playerIndex].push(card);
    });
  }
  const firstDiscard = deck.pop();
  const activePlayerIndex = Math.max(
    0,
    players.findIndex((player) => player.id === options.startingPlayerId),
  );

  return {
    id: `match-${seed}`,
    round: 1,
    status: 'playing',
    players: players.map((player, index) => ({
      ...player,
      phaseId: startingPhaseId,
      score: 0,
      hand: hands[index],
      laidMelds: [],
      completedPhase: false,
    })),
    activePlayerIndex,
    turnStep: 'draw',
    deck,
    discardPile: firstDiscard ? [firstDiscard] : [],
    actionLog: [],
    difficulty: options.difficulty,
  };
}

export function drawCard(
  match: GameMatch,
  playerId: string,
  source: DrawSource,
): GameMatch {
  assertTurn(match, playerId, 'draw');
  const prepared = source === 'deck' ? recycleDeckIfNeeded(match) : match;
  const sourcePile = source === 'deck' ? prepared.deck : prepared.discardPile;
  const card = sourcePile[sourcePile.length - 1];
  if (!card) throw new GameRuleError('CARD_NOT_FOUND', 'That pile is empty.');

  const players = replacePlayer(prepared.players, playerId, (player) => ({
    ...player,
    hand: [...player.hand, card],
  }));
  return appendLog(
    {
      ...prepared,
      players,
      turnStep: 'build',
      deck: source === 'deck' ? prepared.deck.slice(0, -1) : prepared.deck,
      discardPile:
        source === 'discard'
          ? prepared.discardPile.slice(0, -1)
          : prepared.discardPile,
    },
    playerId,
    source === 'deck' ? 'Drew from the deck.' : 'Picked up the discard.',
  );
}

export function layPhase(
  match: GameMatch,
  playerId: string,
  meldInputs: readonly EngineMeldInput[],
): GameMatch {
  assertTurn(match, playerId, 'build');
  const player = getPlayer(match, playerId);
  if (player.completedPhase) {
    throw new GameRuleError(
      'PHASE_ALREADY_COMPLETE',
      'Your phase is already on the table.',
    );
  }

  const melds = meldInputs.map((input) => ({
    ...input,
    cards: input.cardIds.map((cardId) => findCard(player.hand, cardId)),
  }));
  const validation = validatePhase(player.phaseId, melds, match.difficulty);
  if (!validation.valid) {
    throw new GameRuleError('INVALID_PHASE', validation.message);
  }

  const usedIds = new Set(melds.flatMap((meld) => meld.cardIds));
  const laidMelds: LaidMeld[] = melds.map((meld) => ({
    id: meld.id,
    ownerId: playerId,
    phaseId: player.phaseId,
    operation: meld.operation,
    cards: meld.cards,
  }));

  return appendLog(
    {
      ...match,
      players: replacePlayer(match.players, playerId, (current) => ({
        ...current,
        hand: current.hand.filter((card) => !usedIds.has(card.id)),
        laidMelds,
        completedPhase: true,
      })),
    },
    playerId,
    `Completed phase ${player.phaseId}.`,
  );
}

export function hitMeld(
  match: GameMatch,
  playerId: string,
  targetPlayerId: string,
  meldId: string,
  cardIds: readonly CardId[],
  operation: MathOperation,
): GameMatch {
  assertTurn(match, playerId, 'build');
  const player = getPlayer(match, playerId);
  if (!player.completedPhase) {
    throw new GameRuleError(
      'HIT_NOT_ALLOWED',
      'Complete your own phase before hitting.',
    );
  }
  if (cardIds.length === 0 || new Set(cardIds).size !== cardIds.length) {
    throw new GameRuleError(
      'HIT_NOT_ALLOWED',
      'Select one or more different cards to hit the table.',
    );
  }
  const cards = cardIds.map((cardId) => findCard(player.hand, cardId));
  const target = getPlayer(match, targetPlayerId);
  const targetMeld = target.laidMelds.find((meld) => meld.id === meldId);
  if (!targetMeld)
    throw new GameRuleError(
      'CARD_NOT_FOUND',
      'That table group no longer exists.',
    );

  const validation = validateHitOnMeld(
    target,
    targetMeld,
    cards,
    operation,
    match.difficulty,
  );
  if (!validation.valid)
    throw new GameRuleError('HIT_NOT_ALLOWED', validation.message);

  const usedIds = new Set(cardIds);
  let players = replacePlayer(match.players, playerId, (current) => ({
    ...current,
    hand: current.hand.filter((item) => !usedIds.has(item.id)),
  }));
  players = replacePlayer(players, targetPlayerId, (current) => ({
    ...current,
    laidMelds:
      validation.mode === 'extend-run'
        ? current.laidMelds.map((meld) =>
            meld.id === meldId
              ? { ...meld, cards: [...meld.cards, ...cards] }
              : meld,
          )
        : [
            ...current.laidMelds,
            {
              id: `hit-${match.round}-${targetPlayerId}-${target.laidMelds.length + 1}`,
              ownerId: targetPlayerId,
              phaseId: targetMeld.phaseId,
              operation,
              cards,
            },
          ],
  }));

  const updatedPlayer = players.find((item) => item.id === playerId);
  if (!updatedPlayer) throw new Error(`Unknown player: ${playerId}`);
  if (updatedPlayer.hand.length === 0) {
    const winnerId =
      updatedPlayer.phaseId === 10 && updatedPlayer.completedPhase
        ? playerId
        : undefined;
    return appendLog(
      {
        ...match,
        players,
        status: winnerId ? 'match-ended' : 'round-ended',
        winnerId,
      },
      playerId,
      winnerId
        ? 'Hit the table and won the match!'
        : 'Hit the table and went out.',
    );
  }

  return appendLog(
    { ...match, players },
    playerId,
    validation.mode === 'extend-run'
      ? `Extended ${target.name}'s run.`
      : `Added a valid group to ${target.name}'s phase.`,
  );
}

export function validateHitOnMeld(
  target: MatchPlayerState,
  targetMeld: LaidMeld,
  cards: readonly GameCard[],
  operation: MathOperation,
  difficulty: PhaseDifficulty = 'standard',
): HitValidationResult {
  if (cards.length === 0) {
    return { valid: false, message: 'Select cards to hit the table.' };
  }

  const phase = getPhase(targetMeld.phaseId, difficulty);
  const compatibleRequirements = phase.requirements.filter((requirement) =>
    requirement.kind === 'run'
      ? targetMeld.operation === 'run'
      : validateMeld(requirement, targetMeld.cards, targetMeld.operation).valid,
  );
  const runRequirement = compatibleRequirements.find(
    (requirement): requirement is Extract<MeldRequirement, { kind: 'run' }> =>
      requirement.kind === 'run',
  );

  if (runRequirement && targetMeld.operation === 'run') {
    const expandedRequirement = {
      ...runRequirement,
      length: targetMeld.cards.length + cards.length,
    };
    const validation = validateMeld(
      expandedRequirement,
      [...targetMeld.cards, ...cards],
      'run',
    );
    return validation.valid
      ? { ...validation, mode: 'extend-run' }
      : validation;
  }

  if (phase.uniqueOperations) {
    const usedOperations = new Set(
      target.laidMelds
        .filter((meld) => meld.phaseId === targetMeld.phaseId)
        .map((meld) => meld.operation),
    );
    if (usedOperations.has(operation)) {
      return {
        valid: false,
        message: 'Use an operation not already on that player\'s phase.',
      };
    }
  }

  const attempts = compatibleRequirements.map((requirement) =>
    validateMeld(requirement, cards, operation),
  );
  const validAttempt = attempts.find((attempt) => attempt.valid);
  if (validAttempt) return { ...validAttempt, mode: 'add-group' };
  return (
    attempts[0] ?? {
      valid: false,
      message: 'Those cards do not match this completed phase.',
    }
  );
}

export function assignWildValue(
  match: GameMatch,
  playerId: string,
  cardId: CardId,
  value: number,
): GameMatch {
  assertTurn(match, playerId, 'build');
  if (!Number.isInteger(value) || value < 1 || value > 12) {
    throw new GameRuleError(
      'INVALID_PHASE',
      'A wild value must be between 1 and 12.',
    );
  }
  const player = getPlayer(match, playerId);
  const card = findCard(player.hand, cardId);
  if (card.kind !== 'wild') {
    throw new GameRuleError(
      'INVALID_PHASE',
      'Only wild cards can change value.',
    );
  }
  return {
    ...match,
    players: replacePlayer(match.players, playerId, (current) => ({
      ...current,
      hand: current.hand.map((item) =>
        item.id === cardId ? { ...item, lockedValue: value } : item,
      ),
    })),
  };
}

export function discardCard(
  match: GameMatch,
  playerId: string,
  cardId: CardId,
): GameMatch {
  assertTurn(match, playerId, 'build');
  const player = getPlayer(match, playerId);
  const card = findCard(player.hand, cardId);
  const players = replacePlayer(match.players, playerId, (current) => ({
    ...current,
    hand: current.hand.filter((item) => item.id !== cardId),
  }));
  const updatedPlayer = players.find((item) => item.id === playerId);
  if (!updatedPlayer) throw new Error(`Unknown player: ${playerId}`);

  if (updatedPlayer.hand.length === 0) {
    const winnerId =
      updatedPlayer.phaseId === 10 && updatedPlayer.completedPhase
        ? playerId
        : undefined;
    return appendLog(
      {
        ...match,
        players,
        discardPile: [...match.discardPile, card],
        status: winnerId ? 'match-ended' : 'round-ended',
        winnerId,
      },
      playerId,
      winnerId ? 'Won the match!' : 'Went out and ended the round.',
    );
  }

  return appendLog(
    {
      ...match,
      players,
      discardPile: [...match.discardPile, card],
      activePlayerIndex: (match.activePlayerIndex + 1) % match.players.length,
      turnStep: 'draw',
    },
    playerId,
    `Discarded ${card.kind === 'wild' ? 'a wild' : card.value}.`,
  );
}

export function startNextRound(
  match: GameMatch,
  seed = `round-${match.round + 1}`,
): GameMatch {
  if (match.status !== 'round-ended') {
    throw new GameRuleError('NOT_PLAYING', 'The current round has not ended.');
  }
  const next = createMatch(
    match.players.map(({ id, name, seat }) => ({ id, name, seat })),
    {
      seed,
      startingPlayerId: match.players[match.activePlayerIndex].id,
      difficulty: match.difficulty,
    },
  );
  return {
    ...next,
    id: match.id,
    round: match.round + 1,
    players: next.players.map((player) => {
      const previous = getPlayer(match, player.id);
      return {
        ...player,
        phaseId: previous.completedPhase
          ? Math.min(10, previous.phaseId + 1)
          : previous.phaseId,
        score: previous.score + scoreHand(previous.hand),
      };
    }),
    actionLog: match.actionLog,
  };
}

export function activePlayer(match: GameMatch): MatchPlayerState {
  return match.players[match.activePlayerIndex];
}

function assertTurn(match: GameMatch, playerId: string, step: TurnStep): void {
  if (match.status !== 'playing') {
    throw new GameRuleError('NOT_PLAYING', 'The round is not active.');
  }
  if (activePlayer(match).id !== playerId) {
    throw new GameRuleError('NOT_YOUR_TURN', 'Wait for your turn.');
  }
  if (match.turnStep !== step) {
    throw new GameRuleError(
      'WRONG_TURN_STEP',
      step === 'draw' ? 'You have already drawn.' : 'Draw a card first.',
    );
  }
}

function getPlayer(match: GameMatch, playerId: string): MatchPlayerState {
  const player = match.players.find((item) => item.id === playerId);
  if (!player) throw new Error(`Unknown player: ${playerId}`);
  return player;
}

function findCard(cards: readonly GameCard[], cardId: CardId): GameCard {
  const card = cards.find((item) => item.id === cardId);
  if (!card)
    throw new GameRuleError(
      'CARD_NOT_FOUND',
      'That card is no longer in your hand.',
    );
  return card;
}

function replacePlayer(
  players: readonly MatchPlayerState[],
  playerId: string,
  update: (player: MatchPlayerState) => MatchPlayerState,
): MatchPlayerState[] {
  return players.map((player) =>
    player.id === playerId ? update(player) : player,
  );
}

function recycleDeckIfNeeded(match: GameMatch): GameMatch {
  if (match.deck.length > 0 || match.discardPile.length <= 1) return match;
  const topDiscard = match.discardPile[match.discardPile.length - 1];
  if (!topDiscard) return match;
  return {
    ...match,
    deck: match.discardPile.slice(0, -1).reverse(),
    discardPile: [topDiscard],
  };
}

function appendLog(
  match: GameMatch,
  playerId: string,
  message: string,
): GameMatch {
  return {
    ...match,
    actionLog: [
      ...match.actionLog.slice(-19),
      {
        id: `action-${match.round}-${match.actionLog.length + 1}`,
        playerId,
        message,
      },
    ],
  };
}
