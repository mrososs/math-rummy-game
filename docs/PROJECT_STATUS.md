# Project Status and Roadmap

Last updated: July 15, 2026

This document records what is implemented, what is only partially complete, and the recommended work needed to make Math Rummy production-ready.

## Status summary

| Area                      | Status                               | Notes                                                                                                                          |
| ------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Core game engine          | Complete for current rules           | Ten phases, turn order, hits, wilds, scoring, rounds, and match completion are implemented.                                    |
| Offline bot practice      | Playable                             | Configurable bots work end to end; bots do not yet make post-phase hits.                                                       |
| Mobile game interface     | Playable                             | Portrait-first touch UI, rectangular table, swipeable hands/melds, settings, and help are implemented.                         |
| Supabase database         | Implemented                          | Schema, RLS, RPCs, Realtime state, history, stats, and saves migrations exist and have been deployed to a development project. |
| Hosted authentication     | Blocked by configuration             | Anonymous sign-in must be enabled and verified in the target Supabase dashboard.                                               |
| Live multiplayer          | Implemented, needs full verification | Room and snapshot code exists; a complete multi-device production test is still required.                                      |
| Native Android/iOS builds | Not started                          | Capacitor config exists, but native platform projects and store pipelines have not been added.                                 |
| Deployment and CI/CD      | Not started                          | No hosted web deployment or GitHub Actions workflow is configured yet.                                                         |

## Completed work

### Game rules

- Seeded 104-card deck with numbered and wild cards.
- Two-to-eight-player dealing and active-player turn order.
- Draw from deck or discard pile.
- Ten progressive phase definitions with reusable validation.
- Wild-card value assignment.
- Staged phase groups and phase submission.
- Hit validation against the player's own table or another player's table:
  - run extension;
  - target equations;
  - double-value pairs;
  - exact-division pairs;
  - unique-operation restrictions.
- Repeat hits within the same build step.
- Round completion when the last card is discarded or successfully hit.
- Score calculation and phase progression between rounds.
- Match completion after phase ten.

### Bot mode

- One to five configurable bots.
- Easy, standard, and clever difficulty settings.
- Visible thinking state with quick and relaxed turn pacing.
- Bots can draw, find phase solutions, assign wild values, lay phases, and discard.
- Deterministic engine tests for phase solving and normal turns.

### Mobile experience

- Ionic Vue application shell and routing.
- Home, create-room, join-room, lobby, game, settings, and help screens.
- Mobile rectangular felt table with readable piles and cards.
- Finger-swiping for the player's hand and completed-phase lane.
- Sticky hit/discard turn controls.
- Hit Builder with all supported operations after a phase is complete.
- Live hand-card counts for every player.
- Clear validation and turn guidance.
- Responsive portrait and landscape layouts.

### Backend and data access

- Anonymous player profiles.
- Secure room creation, join, leave, readiness, start, and reconnect RPCs.
- Four-character room codes.
- Versioned game snapshots with optimistic-concurrency checks.
- Active-player checks for game updates.
- Row Level Security policies.
- Supabase Realtime room refresh.
- Atomic match-history and profile-stat updates.
- Encrypted save-slot schema and repository support.
- Generated TypeScript database contracts and typed repositories.
- Offline deterministic transport when Supabase is not configured.

### Quality verification

- TypeScript validation through `vue-tsc`.
- ESLint checks across applications and libraries.
- Production Vite build.
- 8 Vitest files with 24 passing tests.
- Mobile Chrome verification of bot turns, swiping, table layout, discard flow, own-phase hits, opponent hits, and invalid-hit messages.

## Partially complete or blocked

### Hosted Supabase authentication

The development Supabase project and migrations exist, but the hosted API previously returned `anonymous_provider_disabled`. The target project must have **Allow anonymous sign-ins** enabled in Auth settings. This must be verified with a real anonymous session before hosted rooms can be considered ready.

### Live multiplayer verification

The room, repository, snapshot, and Realtime code paths are implemented. Remaining verification should cover:

- host plus at least two players on separate devices;
- room creation and code/QR joining;
- readiness and match start;
- turn synchronization and optimistic-concurrency conflicts;
- temporary disconnect and reconnect;
- round completion, phase progression, and match history;
- host leaving and room cleanup behavior.

### Bot strategy

Bots currently solve and lay phases, then discard. They should also evaluate valid hits after completing a phase so bot play follows the same shedding strategy as human play.

### History and saved-game experience

The backend tables and repository methods exist, but dedicated mobile screens for match history, statistics, save slots, and resume management are not implemented.

## Not yet implemented

- GitHub Actions for install, lint, typecheck, test, and build.
- Hosted web deployment and environment management.
- Android and iOS native platform projects.
- App icons, splash assets, signing, and store metadata.
- Automated browser end-to-end tests.
- Push notifications or invitations.
- Public player accounts and account recovery beyond anonymous sessions.
- Production telemetry, crash reporting, and operational dashboards.
- Formal accessibility and performance audits.
- Localization.

## Recommended delivery roadmap

### Milestone 1: Hosted multiplayer unblock

1. Enable and verify anonymous Supabase Auth.
2. Confirm production environment variables.
3. Run the full three-device multiplayer test matrix.
4. Fix synchronization, reconnect, and RLS issues discovered during testing.

### Milestone 2: Complete game behavior

1. Add bot hitting strategy.
2. Add automated tests for every phase's hit rule.
3. Verify round ten and match-winner behavior end to end.
4. Add a visible action log or turn history for multiplayer disputes.

### Milestone 3: Player persistence

1. Build match-history and statistics screens.
2. Build save, list, resume, and delete controls.
3. Test anonymous-session recovery and saved-game ownership rules.

### Milestone 4: Release engineering

1. Add GitHub Actions quality gates.
2. Configure preview and production web deployments.
3. Add Capacitor Android and iOS platforms.
4. Prepare icons, splash screens, signing, privacy text, and store listings.
5. Run accessibility, performance, security, and device-compatibility audits.

## Definition of production-ready

The game should be considered production-ready only when:

- all four quality commands pass in CI;
- anonymous Auth and all migrations are verified in production;
- the complete match flow passes on at least three physical devices;
- reconnect and concurrency behavior is repeatably tested;
- Android/iOS or hosted-web deployment is reproducible;
- privacy, security, accessibility, monitoring, and recovery requirements are documented and tested.
