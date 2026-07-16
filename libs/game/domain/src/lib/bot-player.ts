import {
  cardValue,
  getPhase,
  scoreHand,
  validateMeld,
  type GameCard,
  type MathOperation,
  type MeldRequirement,
} from './game-domain';
import {
  activePlayer,
  assignWildValue,
  discardCard,
  drawCard,
  layPhase,
  type DrawSource,
  type EngineMeldInput,
  type GameMatch,
  type MatchPlayerState,
} from './game-engine';

export type BotDifficulty = 'easy' | 'standard' | 'clever';

export interface BotPhasePlan {
  melds: readonly EngineMeldInput[];
  wildValues: Readonly<Record<string, number>>;
}

export interface PlayBotTurnOptions {
  difficulty?: BotDifficulty;
}

interface MeldCandidate {
  cardIds: readonly string[];
  operation: MathOperation;
  wildValues: Readonly<Record<string, number>>;
}

export function findBotPhasePlan(
  player: MatchPlayerState,
  difficulty: BotDifficulty = 'standard',
): BotPhasePlan | undefined {
  if (player.completedPhase) return undefined;
  const phase = getPhase(player.phaseId, difficulty);
  const candidates = findRequirementPlans(
    phase.requirements,
    player.hand,
    phase.uniqueOperations === true,
  );
  if (!candidates) return undefined;

  return {
    melds: candidates.map((candidate, index) => ({
      id: `bot-meld-${player.phaseId}-${index + 1}`,
      cardIds: candidate.cardIds,
      operation: candidate.operation,
    })),
    wildValues: Object.assign(
      {},
      ...candidates.map((candidate) => candidate.wildValues),
    ) as Readonly<Record<string, number>>,
  };
}

export function playBotTurn(
  match: GameMatch,
  botId: string,
  options: PlayBotTurnOptions = {},
): GameMatch {
  if (match.status !== 'playing' || activePlayer(match).id !== botId) {
    return match;
  }

  // Play style (draw/discard heuristics) follows the requested difficulty, but
  // the PHASE SET must be the match's, since layPhase validates against it.
  const style = options.difficulty ?? match.difficulty ?? 'standard';
  const phaseDifficulty = match.difficulty ?? 'standard';
  const source = chooseDrawSource(match, botId, style, phaseDifficulty);
  let next = drawCard(match, botId, source);
  let player = getPlayer(next, botId);
  const phasePlan = findBotPhasePlan(player, phaseDifficulty);

  if (phasePlan) {
    for (const [cardId, value] of Object.entries(phasePlan.wildValues)) {
      next = assignWildValue(next, botId, cardId, value);
    }
    next = layPhase(next, botId, phasePlan.melds);
    player = getPlayer(next, botId);
  }

  const discard = chooseDiscard(player, style, phaseDifficulty);
  return discard ? discardCard(next, botId, discard.id) : next;
}

function chooseDrawSource(
  match: GameMatch,
  botId: string,
  style: BotDifficulty,
  phaseDifficulty: BotDifficulty,
): DrawSource {
  if (style !== 'clever' || match.discardPile.length === 0) return 'deck';

  const fromDiscard = drawCard(match, botId, 'discard');
  return findBotPhasePlan(getPlayer(fromDiscard, botId), phaseDifficulty)
    ? 'discard'
    : 'deck';
}

function chooseDiscard(
  player: MatchPlayerState,
  style: BotDifficulty,
  phaseDifficulty: BotDifficulty,
): GameCard | undefined {
  if (style === 'easy') return player.hand[0];

  return [...player.hand].sort((left, right) => {
    if (style === 'clever') {
      const utilityDifference =
        cardUtility(player, left, phaseDifficulty) -
        cardUtility(player, right, phaseDifficulty);
      if (utilityDifference !== 0) return utilityDifference;
    }
    return scoreHand([right]) - scoreHand([left]);
  })[0];
}

function cardUtility(
  player: MatchPlayerState,
  card: GameCard,
  difficulty: BotDifficulty = 'standard',
): number {
  if (card.kind === 'wild') return 100;
  const phase = getPhase(player.phaseId, difficulty);
  let utility = 0;

  for (const requirement of phase.requirements) {
    if (requirement.kind === 'run') {
      utility += player.hand.filter((other) => {
        const value = cardValue(other);
        return (
          value !== undefined &&
          other.id !== card.id &&
          Math.abs(value - card.value) === requirement.step
        );
      }).length;
      continue;
    }

    if ('cardCount' in requirement && requirement.cardCount === 2) {
      utility +=
        player.hand.filter((other) => {
          if (other.id === card.id) return false;
          return operationsFor(requirement).some(
            (operation) =>
              validateMeld(requirement, [card, other], operation).valid,
          );
        }).length * 2;
    }
  }
  return utility;
}

function findRequirementPlans(
  requirements: readonly MeldRequirement[],
  availableCards: readonly GameCard[],
  uniqueOperations: boolean,
  requirementIndex = 0,
  usedOperations = new Set<MathOperation>(),
): MeldCandidate[] | undefined {
  if (requirementIndex >= requirements.length) return [];
  const requirement = requirements[requirementIndex];
  const cardCount =
    requirement.kind === 'run' ? requirement.length : requirement.cardCount;

  for (const cards of combinations(availableCards, cardCount)) {
    for (const operation of operationsFor(requirement)) {
      if (uniqueOperations && usedOperations.has(operation)) continue;
      const candidate = validateWithWildValues(requirement, cards, operation);
      if (!candidate) continue;

      const usedIds = new Set(cards.map((card) => card.id));
      const remainingCards = availableCards.filter(
        (card) => !usedIds.has(card.id),
      );
      const nextOperations = new Set(usedOperations).add(operation);
      const rest = findRequirementPlans(
        requirements,
        remainingCards,
        uniqueOperations,
        requirementIndex + 1,
        nextOperations,
      );
      if (rest) return [candidate, ...rest];
    }
  }
  return undefined;
}

function validateWithWildValues(
  requirement: MeldRequirement,
  cards: readonly GameCard[],
  operation: MathOperation,
): MeldCandidate | undefined {
  const unlockedWilds = cards.filter(
    (card) => card.kind === 'wild' && card.lockedValue === undefined,
  );
  if (unlockedWilds.length > 2) return undefined;

  const tryValues = (
    wildIndex: number,
    values: Readonly<Record<string, number>>,
  ): MeldCandidate | undefined => {
    if (wildIndex === unlockedWilds.length) {
      const prepared = cards.map((card) =>
        card.kind === 'wild' && values[card.id] !== undefined
          ? { ...card, lockedValue: values[card.id] }
          : card,
      );
      return validateMeld(requirement, prepared, operation).valid
        ? {
            cardIds: cards.map((card) => card.id),
            operation,
            wildValues: values,
          }
        : undefined;
    }

    const wild = unlockedWilds[wildIndex];
    for (let value = 1; value <= 12; value += 1) {
      const result = tryValues(wildIndex + 1, {
        ...values,
        [wild.id]: value,
      });
      if (result) return result;
    }
    return undefined;
  };

  return tryValues(0, {});
}

function operationsFor(requirement: MeldRequirement): readonly MathOperation[] {
  if (requirement.kind === 'equation') return requirement.operations;
  if (requirement.kind === 'run') return ['run'];
  if (requirement.kind === 'double') return ['double'];
  return ['divide'];
}

function combinations<T>(items: readonly T[], count: number): T[][] {
  const result: T[][] = [];
  const visit = (start: number, selected: T[]): void => {
    if (selected.length === count) {
      result.push(selected);
      return;
    }
    for (
      let index = start;
      index <= items.length - (count - selected.length);
      index += 1
    ) {
      visit(index + 1, [...selected, items[index]]);
    }
  };
  visit(0, []);
  return result;
}

function getPlayer(match: GameMatch, playerId: string): MatchPlayerState {
  const player = match.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error(`Unknown player: ${playerId}`);
  return player;
}
