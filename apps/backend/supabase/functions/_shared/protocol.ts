// Wire protocol shared by the authoritative Edge Functions.
// Mirrored (by hand) into libs/network/contracts for the client — keep in sync.
import type {
  GameCard,
  LaidMeld,
  MatchStatus,
  TurnStep,
  GameActionLog,
  EngineMeldInput,
  MathOperation,
  DrawSource,
} from './game-engine.ts';

/** A wild card value assignment carried inside a lay/hit command. */
export interface WildAssignment {
  cardId: string;
  value: number;
}

/**
 * Commands the client may send. The client sends ONLY its intent plus the
 * expected version — never a full game state. actionId makes each command
 * idempotent.
 */
export type GameCommand =
  | { actionId: string; type: 'DRAW_CARD'; source: DrawSource }
  | {
      actionId: string;
      type: 'LAY_PHASE';
      melds: EngineMeldInput[];
      wildValues?: WildAssignment[];
    }
  | {
      actionId: string;
      type: 'HIT_MELD';
      targetPlayerId: string;
      meldId: string;
      cardIds: string[];
      operation?: MathOperation;
      wildValues?: WildAssignment[];
    }
  | { actionId: string; type: 'DISCARD_CARD'; cardId: string }
  | { actionId: string; type: 'NEXT_ROUND' };

export type GameCommandType = GameCommand['type'];

/** Public per-player state — safe for every room member to see. */
export interface PublicPlayerState {
  id: string;
  name: string;
  seat: number;
  phaseId: number;
  score: number;
  cardCount: number;
  completedPhase: boolean;
  laidMelds: LaidMeld[];
}

/**
 * The sanitized public game state stored in public.game_rooms.game_state.
 * Contains no hands and no deck order.
 */
export interface PublicGameState {
  gameId: string;
  round: number;
  status: MatchStatus;
  activePlayerId: string;
  activePlayerIndex: number;
  turnStep: TurnStep;
  deckCount: number;
  discardTop: GameCard | null;
  discardCount: number;
  winnerId: string | null;
  players: PublicPlayerState[];
  actionLog: GameActionLog[];
}

/**
 * A snapshot personalized for one authenticated player: the public state plus
 * that player's own hand and nothing else private.
 */
export interface PlayerGameSnapshot extends PublicGameState {
  stateVersion: number;
  viewerId: string;
  myHand: GameCard[];
}
