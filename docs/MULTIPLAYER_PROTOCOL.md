# Math Rummy — Multiplayer Protocol & State Visibility

This document describes the **server-authoritative** online multiplayer design
that replaced the original client-authoritative flow (remediation of findings
**F-01** private-state exposure and **F-02** client authority).

## Trust model

The server owns shuffling, dealing, turn transitions, rule validation, scoring,
and winner selection. The client owns only ephemeral UI state (selected cards,
open dialogs, draft equations). Realtime is a **notification** mechanism, not the
source of truth. Every mutating command is atomic, versioned, and idempotent.

## State separation

| Category | Contents | Visible to | Where it lives |
|---|---|---|---|
| Private authoritative | deck order, every hand, shuffle seed | server only | `private.game_states` (not in the Data API; RLS-locked) |
| Public game state | turn, phase, public melds, scores, discard top, deck/card counts | all room members | `public.game_rooms.game_state` (sanitized projection) |
| Player-private | the caller's own hand | that player only | returned by the `game` function per `auth.uid()` |
| Ephemeral UI | selected cards, dialogs, wild drafts | local device only | Pinia (client) |

## Endpoints

Lobby uses the existing SECURITY DEFINER RPCs: `create_game_room`,
`join_game_room`, `get_game_room`, `set_game_room_ready`, `leave_game_room`.

Gameplay goes through one Edge Function, **`game`** (`verify_jwt = true`), which
routes on `op`:

| op | Who | Effect |
|---|---|---|
| `start` | host | Validates lobby (≥2 players, all ready), shuffles + deals on the server, writes `private.game_states` (v1) + the public projection, sets room `playing`. Returns the host's snapshot. |
| `command` | active player (host for `NEXT_ROUND`) | Validates the command (Zod), loads authoritative state, replays it through the shared engine, commits atomically with a version check + `actionId` idempotency. Returns the caller's snapshot. |
| `snapshot` | any member | Returns the caller's personalized snapshot (public state + own hand). Used on load, reconnect/resume, and version-gap resync. |

The engine is a byte-for-byte mirror of `libs/game/domain` under
`apps/backend/supabase/functions/_shared` (guarded by `engine-mirror.spec.ts`).

## Command protocol

The client sends only intent + expected version. `actionId` (a UUID) makes each
command idempotent.

```ts
type GameCommand =
  | { actionId; type: 'DRAW_CARD'; source: 'deck' | 'discard' }
  | { actionId; type: 'LAY_PHASE'; melds: EngineMeldInput[]; wildValues?: WildAssignment[] }
  | { actionId; type: 'HIT_MELD'; targetPlayerId; meldId; cardIds: string[]; operation?; wildValues? }
  | { actionId; type: 'DISCARD_CARD'; cardId: string }
  | { actionId; type: 'NEXT_ROUND' };
```

Wild values are drafted locally (ephemeral) and applied server-side inside the
`LAY_PHASE` / `HIT_MELD` command before validation — no separate round-trip.

Request body: `{ op: 'command', roomId, expectedVersion, command }`.
Response: `{ snapshot: PlayerGameSnapshot | null, stateVersion, duplicate }`.

## Versioning, idempotency, conflicts

- `private.game_states.state_version` is the authoritative counter. Every commit
  is `... where state_version = expectedVersion` inside `commit_game_command`,
  so two commands racing on the same version → exactly one wins; the loser gets
  `40001` → **409 VERSION_CONFLICT**.
- `private.game_action_log(room_id, action_id)` dedupes retries. A replayed
  `actionId` returns the version it already produced (`duplicate: true`) without
  re-running the engine (`peek_command_version` is checked first).
- Illegal moves (wrong turn, unowned card, bad meld) are rejected `422`
  (`ILLEGAL_MOVE`) and recorded via `log_rejected_command`.

## Realtime & recovery

- Clients subscribe to `game_rooms` + `game_room_players` changes. Any change
  triggers a full refetch (room snapshot + `op: snapshot`), so **version gaps
  self-heal** — the client always pulls the latest full snapshot, never deltas.
- On Realtime `SUBSCRIBED` (initial + reconnect) the client refetches.
- The client also refetches on app resume / tab focus / network `online`.
- Commands are serialized through a **FIFO queue** (`use-room-store`), and
  state-changing controls are disabled while a command is in flight.

## Client mapping

- `network-contracts` — protocol types (`GameCommand`, `PlayerGameSnapshot`, …).
- `backend-data-access/room-repository` — `functions.invoke('game', …)`, plus
  `validatePlayerSnapshot` (runtime validation of inbound snapshots, F-04).
- `use-room-store` — FIFO command queue, `commandPending`, snapshot application.
- `use-game-store` — online mode rebuilds a `GameMatch` from the snapshot
  (placeholder opponent hands + deck) so existing components render unchanged;
  bot/offline keeps the local-engine path.

## Verification

- `apps/backend/.../scratchpad`-style `smoke.mjs` (repo history) exercises the
  server end-to-end (29 assertions: private-state hidden, server deal, turn /
  version / idempotency / illegal-move enforcement).
- Engine rules: `game-engine.spec.ts`, `game-engine.edge.spec.ts`.
- Mirror integrity: `engine-mirror.spec.ts`.
- Snapshot validation: `room-repository.spec.ts`.
- End-to-end online play verified in-browser (host UI + scripted second player).

## Definition-of-done status

Done: server-authoritative boundary, private state, per-player snapshots,
server shuffle/deal, command validation, atomic versioned commits, idempotency,
FIFO queue + pending lock, reconnect/resume resync, runtime snapshot validation,
fail-fast prod config, engine + validation tests, browser E2E.

Remaining: durable Deno tests for the Edge Function layer + CI wiring;
extracting a `useGameSession` composable out of `GameView` (F-06).
