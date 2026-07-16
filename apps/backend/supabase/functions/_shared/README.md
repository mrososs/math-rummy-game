# Edge Function shared modules

Authoritative multiplayer runs the game on the server. These modules are shared
by the `start-game`, `game-command`, and `get-snapshot` functions.

## Engine mirror (keep in sync)

`game-domain.ts` and `game-engine.ts` are **mirrors** of
`libs/game/domain/src/lib/`. The engine is pure and framework-free, so the only
difference is the explicit `.ts` import extension Deno requires.

Re-sync after any engine change:

```bash
SHARED=apps/backend/supabase/functions/_shared
SRC=libs/game/domain/src/lib
cp "$SRC/game-domain.ts" "$SHARED/game-domain.ts"
sed "s#from './game-domain'#from './game-domain.ts'#" "$SRC/game-engine.ts" > "$SHARED/game-engine.ts"
```

A guard test in Phase C asserts the mirror matches the source (ignoring the
import extension). Do not hand-edit the engine mirrors.

## Trust boundary

- `protocol.ts` — the wire protocol (`GameCommand`, `PublicGameState`,
  `PlayerGameSnapshot`). Mirrored by hand in `libs/network/contracts`.
- `projection.ts` — turns the authoritative `GameMatch` into sanitized views.
  Never leak deck order, opponent hands, or the shuffle seed.
- `commands.ts` — Zod validation + engine replay for incoming commands.
- `admin.ts` — service-role RPC wrappers (`commit_game_*`, `read_*`, `peek_*`).
- `auth.ts` — resolves `auth.uid()` from the caller's bearer token.
