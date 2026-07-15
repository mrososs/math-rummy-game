# Supabase backend

This Nx application owns the Supabase CLI lifecycle, database migrations, row-level security, generated database types, and the live multiplayer room backend.

The migrations provide:

- anonymous authenticated player profiles;
- four-character room creation and secure code-based joining;
- room membership, readiness, start, leave, and reconnect flows;
- versioned game snapshots with active-player and optimistic-concurrency checks;
- Realtime updates for room and player changes;
- atomic match-history recording, profile statistics, and encrypted save slots.

Run `nx start backend` after Docker Desktop is available. Link and push to a remote Supabase project only through an authenticated Supabase MCP or an explicitly linked CLI environment.

The mobile app uses the Supabase backend when both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are present. Without them it keeps the deterministic offline demo transport for design and engine testing.
