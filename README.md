# Math Rummy

Math Rummy is a mobile-first multiplayer card game where players complete ten progressive math phases, hit compatible phases on the table, and try to empty their hand first. The project includes an offline bot-practice mode and a Supabase backend for live rooms, synchronized matches, history, and saved games.

> Project status: active development. Bot matches and the core game loop are playable. Hosted multiplayer still needs final authentication configuration and multi-device production verification. See [Project status and roadmap](docs/PROJECT_STATUS.md).

## Current features

- A deterministic 104-card deck for two to eight players.
- Ten math phases covering addition, subtraction, multiplication, division, doubles, and runs.
- Complete draw, build, lay-phase, hit, discard, scoring, round, and match rules.
- Validated hits on the player's own phase or another player's compatible phase.
- Automatic round completion when a discard or valid hit empties a player's hand.
- Offline practice matches with configurable bot count, difficulty, and turn pace.
- Mobile-first Ionic interface with touch-scrolling card hands and completed phases.
- Visible player hand counts and bot-thinking status.
- Settings and game-help screens.
- Supabase migrations for rooms, membership, Realtime state, match history, profiles, and save slots.
- Typed Supabase repositories with an offline deterministic fallback.
- Unit tests for the rule engine, bot player, state stores, and backend data access.

## Technology

- Vue 3, TypeScript, Pinia, and Vue Router
- Ionic Vue and Capacitor
- Nx monorepo tooling
- Supabase Auth, Postgres, Row Level Security, RPCs, and Realtime
- Vitest, Vue Test Utils, ESLint, and `vue-tsc`

## Repository structure

```text
apps/
  mobile/                  Ionic Vue mobile client
  backend/supabase/        Supabase config, migrations, and seed
libs/
  game/domain/             Pure game rules, phases, bots, and scoring
  game/state/              Pinia game orchestration
  room/state/              Room, lobby, QR, and transport state
  network/contracts/       Shared room and transport contracts
  backend/data-access/     Supabase client, types, and repositories
  shared/ui/               Reusable card and player components
docs/
  PROJECT_STATUS.md        Completed work, gaps, and delivery roadmap
```

## Requirements

- Node.js 22 or a compatible current LTS release
- npm
- Docker Desktop for the local Supabase stack
- Supabase CLI access for local or hosted backend work

## Install and run

```bash
git clone https://github.com/mrososs/math-rummy-game.git
cd math-rummy-game
npm install
npm start
```

The Nx development server normally starts at `http://localhost:4200`. To test from a phone, bind the Vite/Nx server to `0.0.0.0` and open the computer's LAN address while both devices are on the same Wi-Fi network.

Bot practice works without Supabase. Choose **Play with bots** on the home screen.

## Supabase setup

Start the local backend:

```bash
npm run backend:start
npm run backend:reset
npm run backend:types
```

Copy the environment template:

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
```

Set the values printed by Supabase:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

For a hosted project:

1. Create or link a Supabase project.
2. Apply the migrations from `apps/backend/supabase/migrations` in timestamp order.
3. Enable anonymous sign-ins in Supabase Auth.
4. Set the hosted URL and publishable key in `apps/mobile/.env.local`.
5. Never commit `.env.local`, service-role keys, access tokens, or database passwords.

If the environment variables are absent, the app deliberately uses its offline deterministic transport.

## How a turn works

1. Draw from the deck or the discard pile.
2. Build and lay the current phase if possible.
3. After completing a phase, select cards and an operation in **Hit Builder**.
4. Tap your own completed phase or another player's phase. The engine validates against the selected target's rules.
5. Repeat valid hits, or select one unstaged card and press **End turn · discard**.
6. Emptying the hand through either a hit or discard ends the round.

## Quality checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Current verified baseline: 8 test files and 24 passing tests.

## Mobile packaging

After adding the Android or iOS Capacitor platform:

```bash
npm run cap:sync
```

Native projects are not committed yet; see the roadmap before preparing a store build.

## Documentation

- [Project status, limitations, and roadmap](docs/PROJECT_STATUS.md)
- [Supabase backend notes](apps/backend/README.md)
