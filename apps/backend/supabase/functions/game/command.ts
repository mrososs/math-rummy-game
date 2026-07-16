// op: "command" — the authoritative command handler. The client sends
// { roomId, expectedVersion, command }. The server verifies membership + turn,
// replays the command through the real engine, and commits atomically with a
// version check. It never trusts a client-supplied game state.
import { z } from 'npm:zod@3';
import { jsonResponse, HttpError } from '../_shared/http.ts';
import {
  readAuthoritativeState,
  peekCommandVersion,
  commitCommand,
  logRejectedCommand,
} from '../_shared/admin.ts';
import { parseCommand, applyCommand } from '../_shared/commands.ts';
import { toPublicProjection, toPlayerSnapshot } from '../_shared/projection.ts';
import { randomSeed } from '../_shared/random.ts';
import type { GameMatch } from '../_shared/game-engine.ts';

const bodySchema = z.object({
  op: z.literal('command'),
  roomId: z.string().uuid(),
  expectedVersion: z.number().int().min(0),
  command: z.unknown(),
});

export async function handleCommand(
  userId: string,
  rawBody: unknown,
): Promise<Response> {
  const startedAt = performance.now();
  const body = bodySchema.parse(rawBody);
  const command = parseCommand(body.command);

  // Idempotency: a replayed actionId is a no-op success, checked before we
  // touch the engine so a stale expectedVersion cannot turn a retry into an
  // "illegal move" rejection.
  const alreadyApplied = await peekCommandVersion(body.roomId, command.actionId);

  const auth = await readAuthoritativeState(body.roomId);
  if (!auth.players.some((player) => player.id === userId)) {
    throw new HttpError(403, 'You are not a member of this room.', 'FORBIDDEN');
  }
  if (!auth.state) {
    throw new HttpError(409, 'This game has not started yet.', 'NOT_STARTED');
  }

  if (alreadyApplied !== null) {
    return jsonResponse({
      snapshot: toPlayerSnapshot(auth.state, userId, auth.stateVersion),
      stateVersion: auth.stateVersion,
      duplicate: true,
    });
  }

  if (command.type === 'NEXT_ROUND' && auth.hostId !== userId) {
    throw new HttpError(403, 'Only the host can start the next round.', 'FORBIDDEN');
  }

  if (body.expectedVersion !== auth.stateVersion) {
    throw new HttpError(
      409,
      'The game changed on another device. Sync and try again.',
      'VERSION_CONFLICT',
    );
  }

  const seed = randomSeed('round');
  let nextMatch: GameMatch;
  try {
    nextMatch = applyCommand(auth.state, userId, command, seed);
  } catch (engineError) {
    const reason =
      engineError instanceof Error ? engineError.message : 'Illegal move.';
    await logRejectedCommand({
      roomId: body.roomId,
      actionId: command.actionId,
      actorId: userId,
      commandType: command.type,
      reason,
    });
    throw new HttpError(422, reason, 'ILLEGAL_MOVE');
  }

  const commit = await commitCommand({
    roomId: body.roomId,
    expectedVersion: auth.stateVersion,
    actionId: command.actionId,
    actorId: userId,
    commandType: command.type,
    privateState: nextMatch,
    publicState: toPublicProjection(nextMatch),
    seed,
    status: nextMatch.status,
  });

  if (commit.duplicate) {
    const current = await readAuthoritativeState(body.roomId);
    return jsonResponse({
      snapshot: current.state
        ? toPlayerSnapshot(current.state, userId, current.stateVersion)
        : null,
      stateVersion: commit.stateVersion,
      duplicate: true,
    });
  }

  console.log(
    JSON.stringify({
      evt: 'command',
      type: command.type,
      room: body.roomId,
      version: commit.stateVersion,
      ms: Math.round(performance.now() - startedAt),
    }),
  );

  return jsonResponse({
    snapshot: toPlayerSnapshot(nextMatch, userId, commit.stateVersion),
    stateVersion: commit.stateVersion,
    duplicate: false,
  });
}
