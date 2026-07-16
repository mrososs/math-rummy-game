// Authoritative multiplayer entrypoint. One function, three operations:
//   op: "start"    -> host starts the game (server shuffles + deals)
//   op: "command"  -> a validated game command replayed by the engine
//   op: "snapshot" -> the caller's personalized, sanitized snapshot
//
// JWT verification is enforced by the platform (verify_jwt = true); we also
// resolve auth.uid() from the bearer token for authorization.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  handlePreflight,
  readJson,
  errorResponse,
  HttpError,
} from '../_shared/http.ts';
import { requireUserId } from '../_shared/auth.ts';
import { handleStart } from './start.ts';
import { handleCommand } from './command.ts';
import { handleSnapshot } from './snapshot.ts';

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const userId = await requireUserId(req);
    const body = await readJson<{ op?: string }>(req);
    switch (body?.op) {
      case 'start':
        return await handleStart(userId, body);
      case 'command':
        return await handleCommand(userId, body);
      case 'snapshot':
        return await handleSnapshot(userId, body);
      default:
        throw new HttpError(
          400,
          `Unknown operation: ${String(body?.op ?? '(none)')}.`,
          'UNKNOWN_OP',
        );
    }
  } catch (error) {
    return errorResponse(error);
  }
});
