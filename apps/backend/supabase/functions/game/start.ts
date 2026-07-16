// op: "start" — host-only. Shuffles and deals ON THE SERVER, stores the
// authoritative match in private.game_states, returns the host's snapshot.
import { z } from 'npm:zod@3';
import { jsonResponse, HttpError } from '../_shared/http.ts';
import { readAuthoritativeState, commitStart } from '../_shared/admin.ts';
import { createMatch } from '../_shared/game-engine.ts';
import { toPublicProjection, toPlayerSnapshot } from '../_shared/projection.ts';
import { randomSeed } from '../_shared/random.ts';

const bodySchema = z.object({
  op: z.literal('start'),
  roomId: z.string().uuid(),
  startingPhaseId: z.number().int().min(1).max(10).optional(),
});

export async function handleStart(
  userId: string,
  rawBody: unknown,
): Promise<Response> {
  const body = bodySchema.parse(rawBody);
  const auth = await readAuthoritativeState(body.roomId);

  if (auth.hostId !== userId) {
    throw new HttpError(403, 'Only the host can start the game.', 'FORBIDDEN');
  }
  if (auth.roomStatus !== 'lobby') {
    throw new HttpError(409, 'This room is not waiting in the lobby.', 'NOT_LOBBY');
  }

  const players = [...auth.players].sort((a, b) => a.seat - b.seat);
  if (players.length < 2) {
    throw new HttpError(400, 'At least two players are required.', 'TOO_FEW_PLAYERS');
  }
  if (players.length > auth.maxPlayers) {
    throw new HttpError(400, 'This room already has too many players.', 'TOO_MANY_PLAYERS');
  }
  if (players.some((player) => !player.isReady)) {
    throw new HttpError(409, 'Every player must be ready before starting.', 'NOT_READY');
  }

  const seed = randomSeed('deal');
  const match = createMatch(
    players.map((player) => ({
      id: player.id,
      name: player.name,
      seat: player.seat,
    })),
    {
      seed,
      startingPlayerId: players[0].id,
      startingPhaseId: body.startingPhaseId ?? 1,
    },
  );

  const stateVersion = await commitStart({
    roomId: body.roomId,
    hostId: userId,
    privateState: match,
    publicState: toPublicProjection(match),
    seed,
  });

  return jsonResponse({
    snapshot: toPlayerSnapshot(match, userId, stateVersion),
    stateVersion,
  });
}
