// AUTO-MIRRORED from libs/game/domain/src/lib — do not edit here.
// Kept in sync for the Deno Edge Function runtime (see functions/_shared/README.md).
// The engine is pure and framework-free, so this is a byte-for-byte copy except
// for the explicit .ts import extension Deno requires.

export type CardId = string;

export interface NumberCard {
  id: CardId;
  kind: 'number';
  value: number;
}

export interface WildCard {
  id: CardId;
  kind: 'wild';
  lockedValue?: number;
}

export type GameCard = NumberCard | WildCard;
export type MathOperation =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'run'
  | 'double';

export type MeldRequirement =
  | {
      kind: 'equation';
      target: number;
      cardCount: number;
      operations: readonly MathOperation[];
    }
  | { kind: 'run'; length: number; step: number; evenOnly?: boolean }
  | { kind: 'double'; cardCount: 2 }
  | { kind: 'exact-division'; cardCount: 2 };

export interface PhaseDefinition {
  id: number;
  title: string;
  shortTitle: string;
  hitRule: string;
  example: readonly number[];
  requirements: readonly MeldRequirement[];
  uniqueOperations?: boolean;
}

export interface MeldDraft {
  id: string;
  cardIds: readonly CardId[];
  operation: MathOperation;
}

export interface ValidationResult {
  valid: boolean;
  message: string;
}

const ARITHMETIC_OPERATIONS: readonly MathOperation[] = [
  'add',
  'subtract',
  'multiply',
  'divide',
];

export const PHASES: readonly PhaseDefinition[] = [
  {
    id: 1,
    title: 'Build two 2-card additions that equal 10',
    shortTitle: 'Two sums of 10',
    hitRule: 'Add a new 2-card addition that equals 10.',
    example: [3, 7],
    requirements: Array.from({ length: 2 }, () => ({
      kind: 'equation' as const,
      target: 10,
      cardCount: 2,
      operations: ['add'] as const,
    })),
  },
  {
    id: 2,
    title: 'Build two equations that equal 12',
    shortTitle: 'Two ways to make 12',
    hitRule: 'Add a new equation that equals 12.',
    example: [3, 4],
    requirements: Array.from({ length: 2 }, () => ({
      kind: 'equation' as const,
      target: 12,
      cardCount: 2,
      operations: ARITHMETIC_OPERATIONS,
    })),
  },
  {
    id: 3,
    title: 'Build a run of 5 consecutive numbers',
    shortTitle: 'Run of 5',
    hitRule: 'Extend either end while keeping a step of 1.',
    example: [4, 5, 6, 7, 8],
    requirements: [{ kind: 'run', length: 5, step: 1 }],
  },
  {
    id: 4,
    title: 'Build 3 double-value pairs',
    shortTitle: 'Three doubles',
    hitRule: 'Add one complete double-value pair.',
    example: [3, 6],
    requirements: Array.from({ length: 3 }, () => ({
      kind: 'double' as const,
      cardCount: 2 as const,
    })),
  },
  {
    id: 5,
    title: 'Build two equations that equal 15',
    shortTitle: 'Two ways to make 15',
    hitRule: 'Add a new equation that equals 15.',
    example: [7, 8],
    requirements: Array.from({ length: 2 }, () => ({
      kind: 'equation' as const,
      target: 15,
      cardCount: 2,
      operations: ARITHMETIC_OPERATIONS,
    })),
  },
  {
    id: 6,
    title: 'Build 3 exact division equations',
    shortTitle: 'Three exact divisions',
    hitRule: 'Add a division pair with a whole-number result.',
    example: [12, 3],
    requirements: Array.from({ length: 3 }, () => ({
      kind: 'exact-division' as const,
      cardCount: 2 as const,
    })),
  },
  {
    id: 7,
    title: 'Make 24 in two different ways',
    shortTitle: 'Two ways to make 24',
    hitRule: 'Add a different equation that equals 24.',
    example: [6, 4],
    uniqueOperations: true,
    requirements: Array.from({ length: 2 }, () => ({
      kind: 'equation' as const,
      target: 24,
      cardCount: 2,
      operations: ARITHMETIC_OPERATIONS,
    })),
  },
  {
    id: 8,
    title: 'Build a 5-number even run',
    shortTitle: 'Even run of 5',
    hitRule: 'Extend either end while keeping a step of 2.',
    example: [2, 4, 6, 8, 10],
    requirements: [{ kind: 'run', length: 5, step: 2, evenOnly: true }],
  },
  {
    id: 9,
    title: 'Build 3 equations that equal 18',
    shortTitle: 'Three ways to make 18',
    hitRule: 'Add a new solution using another operation.',
    example: [9, 2],
    uniqueOperations: true,
    requirements: Array.from({ length: 3 }, () => ({
      kind: 'equation' as const,
      target: 18,
      cardCount: 2,
      operations: ARITHMETIC_OPERATIONS,
    })),
  },
  {
    id: 10,
    title: 'Build a run plus an equation that equals 20',
    shortTitle: 'Run + make 20',
    hitRule: 'Hit either group according to its rule.',
    example: [4, 5, 6, 7, 8],
    requirements: [
      { kind: 'run', length: 5, step: 1 },
      {
        kind: 'equation',
        target: 20,
        cardCount: 2,
        operations: ARITHMETIC_OPERATIONS,
      },
    ],
  },
] as const;

export const DEMO_HAND: readonly GameCard[] = [
  { id: 'demo-2', kind: 'number', value: 2 },
  { id: 'demo-3-a', kind: 'number', value: 3 },
  { id: 'demo-3-b', kind: 'number', value: 3 },
  { id: 'demo-5', kind: 'number', value: 5 },
  { id: 'demo-6', kind: 'number', value: 6 },
  { id: 'demo-7', kind: 'number', value: 7 },
  { id: 'demo-9', kind: 'number', value: 9 },
  { id: 'demo-11', kind: 'number', value: 11 },
  { id: 'demo-wild', kind: 'wild', lockedValue: 4 },
  { id: 'demo-12', kind: 'number', value: 12 },
] as const;

export function getPhase(phaseId: number): PhaseDefinition {
  return PHASES.find((phase) => phase.id === phaseId) ?? PHASES[0];
}

export function cardValue(card: GameCard): number | undefined {
  return card.kind === 'number' ? card.value : card.lockedValue;
}

export function operationSymbol(operation: MathOperation): string {
  return (
    {
      add: '+',
      subtract: '−',
      multiply: '×',
      divide: '÷',
      run: '→',
      double: '2×',
    } satisfies Record<MathOperation, string>
  )[operation];
}

export function evaluateCards(
  cards: readonly GameCard[],
  operation: MathOperation,
): number | undefined {
  const values = cards.map(cardValue);
  if (values.some((value) => value === undefined) || values.length === 0) {
    return undefined;
  }

  const numbers = values as number[];
  if (operation === 'add')
    return numbers.reduce((total, value) => total + value, 0);
  if (operation === 'multiply') {
    return numbers.reduce((total, value) => total * value, 1);
  }
  if (operation === 'subtract') {
    return numbers.slice(1).reduce((total, value) => total - value, numbers[0]);
  }
  if (operation === 'divide') {
    return numbers.slice(1).reduce((total, value) => total / value, numbers[0]);
  }
  return undefined;
}

export function validateMeld(
  requirement: MeldRequirement,
  cards: readonly GameCard[],
  operation: MathOperation,
): ValidationResult {
  const values = cards.map(cardValue);
  if (values.some((value) => value === undefined)) {
    return { valid: false, message: 'Choose a value for every wild card.' };
  }
  const numbers = values as number[];

  // Doubles and exact-division are fixed 2-card pairs; equations may combine
  // any 2+ cards to reach the target with a single operation.
  if (
    (requirement.kind === 'double' || requirement.kind === 'exact-division') &&
    cards.length !== requirement.cardCount
  ) {
    return {
      valid: false,
      message: `This group needs exactly ${requirement.cardCount} cards.`,
    };
  }

  if (requirement.kind === 'equation' && cards.length < 2) {
    return { valid: false, message: 'An equation needs at least 2 cards.' };
  }

  if (requirement.kind === 'equation') {
    if (!requirement.operations.includes(operation)) {
      return { valid: false, message: 'That operation is not allowed here.' };
    }
    const result = evaluateCards(cards, operation);
    return result === requirement.target
      ? { valid: true, message: `Valid equation: ${requirement.target}.` }
      : {
          valid: false,
          message: `This equation equals ${formatResult(result)}, not ${requirement.target}.`,
        };
  }

  if (requirement.kind === 'run') {
    if (operation !== 'run') {
      return { valid: false, message: 'Choose the Run operation.' };
    }
    if (cards.length !== requirement.length) {
      return {
        valid: false,
        message: `This run needs exactly ${requirement.length} cards.`,
      };
    }
    const sorted = [...numbers].sort((a, b) => a - b);
    const hasCorrectStep = sorted.every(
      (value, index) =>
        index === 0 || value - sorted[index - 1] === requirement.step,
    );
    const isEven =
      !requirement.evenOnly || sorted.every((value) => value % 2 === 0);
    return hasCorrectStep && isEven
      ? { valid: true, message: 'Valid run.' }
      : {
          valid: false,
          message: `Cards must form a ${requirement.step === 1 ? 'consecutive' : 'step-of-2'} run.`,
        };
  }

  if (requirement.kind === 'double') {
    const [first, second] = [...numbers].sort((a, b) => a - b);
    return operation === 'double' && second === first * 2
      ? { valid: true, message: 'Valid double-value pair.' }
      : {
          valid: false,
          message: 'One value must be exactly double the other.',
        };
  }

  const [small, large] = [...numbers].sort((a, b) => a - b);
  return operation === 'divide' && small !== 0 && large % small === 0
    ? { valid: true, message: `Valid exact division: ${large / small}.` }
    : {
        valid: false,
        message: 'The larger value must divide exactly by the smaller.',
      };
}

export function validateMeldForPhase(
  phaseId: number,
  cards: readonly GameCard[],
  operation: MathOperation,
): ValidationResult {
  const phase = getPhase(phaseId);
  const attempts = phase.requirements.map((requirement) =>
    validateMeld(requirement, cards, operation),
  );
  return attempts.find((attempt) => attempt.valid) ?? attempts[0];
}

export function validatePhase(
  phaseId: number,
  melds: readonly { cards: readonly GameCard[]; operation: MathOperation }[],
): ValidationResult {
  const phase = getPhase(phaseId);
  if (melds.length !== phase.requirements.length) {
    return {
      valid: false,
      message: `Phase ${phase.id} needs ${phase.requirements.length} complete group${phase.requirements.length === 1 ? '' : 's'}.`,
    };
  }

  const allIds = melds.flatMap((meld) => meld.cards.map((card) => card.id));
  if (new Set(allIds).size !== allIds.length) {
    return { valid: false, message: 'A card can only be used in one group.' };
  }

  if (!canAssignRequirements(phase.requirements, melds)) {
    return {
      valid: false,
      message: 'The staged groups do not complete this phase.',
    };
  }

  if (phase.uniqueOperations) {
    const operations = melds.map((meld) => meld.operation);
    if (new Set(operations).size !== operations.length) {
      return {
        valid: false,
        message: 'Use a different operation for each equation.',
      };
    }
  }

  return { valid: true, message: `Phase ${phase.id} is complete.` };
}

export function scoreHand(cards: readonly GameCard[]): number {
  return cards.reduce(
    (total, card) => total + (card.kind === 'wild' ? 25 : card.value),
    0,
  );
}

export function createDeck(
  options: {
    copiesPerNumber?: number;
    wildCount?: number;
    seed?: string;
  } = {},
): GameCard[] {
  const { copiesPerNumber = 8, wildCount = 8, seed = 'math-rummy' } = options;
  const cards: GameCard[] = [];
  for (let copy = 0; copy < copiesPerNumber; copy += 1) {
    for (let value = 1; value <= 12; value += 1) {
      cards.push({ id: `n-${value}-${copy}`, kind: 'number', value });
    }
  }
  for (let index = 0; index < wildCount; index += 1) {
    cards.push({ id: `wild-${index}`, kind: 'wild' });
  }
  return shuffle(cards, seed);
}

function canAssignRequirements(
  requirements: readonly MeldRequirement[],
  melds: readonly { cards: readonly GameCard[]; operation: MathOperation }[],
  requirementIndex = 0,
  usedMelds = new Set<number>(),
): boolean {
  if (requirementIndex === requirements.length) return true;
  return melds.some((meld, meldIndex) => {
    if (usedMelds.has(meldIndex)) return false;
    if (
      !validateMeld(requirements[requirementIndex], meld.cards, meld.operation)
        .valid
    ) {
      return false;
    }
    const nextUsed = new Set(usedMelds).add(meldIndex);
    return canAssignRequirements(
      requirements,
      melds,
      requirementIndex + 1,
      nextUsed,
    );
  });
}

function shuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  let state = [...seed].reduce(
    (value, char) => value + char.charCodeAt(0),
    2166136261,
  );
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    const swapIndex = Math.abs(state >>> 0) % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function formatResult(result: number | undefined): string {
  if (result === undefined || !Number.isFinite(result))
    return 'an invalid value';
  return Number.isInteger(result) ? String(result) : result.toFixed(2);
}
