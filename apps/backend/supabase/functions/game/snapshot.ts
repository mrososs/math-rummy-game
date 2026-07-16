// op: "snapshot" — returns the caller's personalized snapshot (public state +
// their own hand). Used on load, after reconnect/resume, and whenever a Realtime
// notification or version gap tells the client to resync.
import { z } from 'npm:zod@3';
import { jsonResponse, HttpError } from '../_shared/http.ts';
import { readAuthoritativeState } from '../_shared/admin.ts';
import { toPlayerSnapshot } from '../_shared/projection.ts';

const bodySchema = z.object({
  op: z.literal('snapshot'),
  roomId: z.string().uuid(),
});

export async function handleSnapshot(
  userId: string,
  rawBody: unknown,
): Promise<Response> {
  const body = bodySchema.parse(rawBody);
  const auth = await readAuthoritativeState(body.roomId);

  if (!auth.players.some((player) => player.id === userId)) {
    throw new HttpError(403, 'You are not a member of this room.', 'FORBIDDEN');
  }

  if (!auth.state) {
    return jsonResponse({ snapshot: null, stateVersion: auth.stateVersion });
  }

  return jsonResponse({
    snapshot: toPlayerSnapshot(auth.state, userId, auth.stateVersion),
    stateVersion: auth.stateVersion,
  });
}
