// Validates incoming commands (F-04) and replays them through the shared engine.
import { z } from 'npm:zod@3';
import {
  drawCard,
  layPhase,
  hitMeld,
  discardCard,
  assignWildValue,
  startNextRound,
  type GameMatch,
  type MathOperation,
} from './game-engine.ts';
import type { GameCommand, WildAssignment } from './protocol.ts';
import { HttpError } from './http.ts';

const cardId = z.string().min(1).max(64);
const actionId = z.string().min(1).max(100);
const operation = z.enum([
  'add',
  'subtract',
  'multiply',
  'divide',
  'run',
  'double',
]);
const wildValue = z.object({
  cardId,
  value: z.number().int().min(1).max(12),
});
const meldInput = z.object({
  id: z.string().min(1).max(64),
  cardIds: z.array(cardId).min(1).max(14),
  operation,
});

export const commandSchema = z.discriminatedUnion('type', [
  z.object({
    actionId,
    type: z.literal('DRAW_CARD'),
    source: z.enum(['deck', 'discard']),
  }),
  z.object({
    actionId,
    type: z.literal('LAY_PHASE'),
    melds: z.array(meldInput).min(1).max(4),
    wildValues: z.array(wildValue).max(14).optional(),
  }),
  z.object({
    actionId,
    type: z.literal('HIT_MELD'),
    targetPlayerId: z.string().min(1).max(80),
    meldId: z.string().min(1).max(80),
    cardIds: z.array(cardId).min(1).max(14),
    operation: operation.optional(),
    wildValues: z.array(wildValue).max(14).optional(),
  }),
  z.object({
    actionId,
    type: z.literal('DISCARD_CARD'),
    cardId,
  }),
  z.object({
    actionId,
    type: z.literal('NEXT_ROUND'),
  }),
]);

export function parseCommand(raw: unknown): GameCommand {
  const result = commandSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join('.') || 'command';
    throw new HttpError(
      400,
      `Invalid command (${path}): ${first?.message ?? 'malformed payload'}.`,
      'INVALID_COMMAND',
    );
  }
  return result.data as GameCommand;
}

function applyWildValues(
  match: GameMatch,
  playerId: string,
  wildValues: WildAssignment[] | undefined,
): GameMatch {
  let next = match;
  for (const assignment of wildValues ?? []) {
    next = assignWildValue(next, playerId, assignment.cardId, assignment.value);
  }
  return next;
}

/**
 * Runs a validated command against the authoritative match as `playerId`.
 * The engine enforces turn order, phase rules, card ownership, and win
 * conditions, so a tampered client cannot produce an illegal state.
 * `seed` is used only for NEXT_ROUND (server-generated).
 */
export function applyCommand(
  match: GameMatch,
  playerId: string,
  command: GameCommand,
  seed: string,
): GameMatch {
  switch (command.type) {
    case 'DRAW_CARD':
      return drawCard(match, playerId, command.source);
    case 'LAY_PHASE':
      return layPhase(
        applyWildValues(match, playerId, command.wildValues),
        playerId,
        command.melds,
      );
    case 'HIT_MELD':
      return hitMeld(
        applyWildValues(match, playerId, command.wildValues),
        playerId,
        command.targetPlayerId,
        command.meldId,
        command.cardIds,
        (command.operation ?? 'add') as MathOperation,
      );
    case 'DISCARD_CARD':
      return discardCard(match, playerId, command.cardId);
    case 'NEXT_ROUND':
      return startNextRound(match, seed);
  }
}
