export type TransportKind = 'auto' | 'wifi' | 'hotspot' | 'bluetooth';
export type ConnectionQuality = 'strong' | 'good' | 'weak' | 'reconnecting';
export type RoomStatus =
  | 'home'
  | 'discovery'
  | 'lobby'
  | 'syncing'
  | 'playing'
  | 'reconnecting'
  | 'finished';

export interface RoomPlayer {
  id: string;
  name: string;
  seat: number;
  color: string;
  isHost: boolean;
  isReady: boolean;
  cardsRemaining: number;
  connection: ConnectionQuality;
  transport: Exclude<TransportKind, 'auto'>;
}

export interface RoomSnapshot {
  code: string;
  maxPlayers: number;
  hostId: string;
  status: RoomStatus;
  transport: TransportKind;
  players: readonly RoomPlayer[];
}

export interface NearbyRoom {
  code: string;
  name: string;
  hostName: string;
  transport: Exclude<TransportKind, 'auto'>;
  connection: ConnectionQuality;
}

export interface CreateRoomInput {
  hostName: string;
  maxPlayers: number;
  transport: TransportKind;
}

export interface JoinRoomInput {
  playerName: string;
  roomCode: string;
}

export interface LocalRoomTransport {
  readonly kind: Exclude<TransportKind, 'auto'>;
  createRoom(input: CreateRoomInput): Promise<RoomSnapshot>;
  joinRoom(input: JoinRoomInput): Promise<RoomSnapshot>;
  leaveRoom(): Promise<void>;
  subscribe(listener: (room: RoomSnapshot) => void): () => void;
}

// Wire-shaped mirrors of the game-domain card/meld types. `contracts` is a
// leaf lib (it may not depend on game-domain), and these are structurally
// identical, so values flow between the two without conversion.
export type MathOperation =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'run'
  | 'double';
export type TurnStep = 'draw' | 'build';
export type DrawSource = 'deck' | 'discard';
export type MatchStatus = 'playing' | 'round-ended' | 'match-ended';

export interface NumberCard {
  id: string;
  kind: 'number';
  value: number;
}
export interface WildCard {
  id: string;
  kind: 'wild';
  lockedValue?: number;
}
export type GameCard = NumberCard | WildCard;

export interface LaidMeld {
  id: string;
  ownerId: string;
  phaseId: number;
  operation: MathOperation;
  cards: readonly GameCard[];
}

export interface GameActionLog {
  id: string;
  playerId: string;
  message: string;
}

export interface EngineMeldInput {
  id: string;
  cardIds: readonly string[];
  operation: MathOperation;
}

/**
 * A wild-card value assignment carried inside a lay/hit command. Wild values
 * are ephemeral (drafted on the client) until the player commits the meld.
 */
export interface WildAssignment {
  cardId: string;
  value: number;
}

/**
 * Commands the client sends to the authoritative server. The client sends ONLY
 * its intent plus the expected version — never a full game state. `actionId`
 * makes each command idempotent.
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

/** Public per-player game state — safe for every room member. */
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

/** The sanitized public game state (no hands, no deck order). */
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

/** A snapshot personalized for one authenticated player. */
export interface PlayerGameSnapshot extends PublicGameState {
  stateVersion: number;
  viewerId: string;
  myHand: GameCard[];
}

export interface LiveRoomSnapshot {
  roomId: string;
  room: RoomSnapshot;
  stateVersion: number;
  /** Sanitized public game state (also stored in game_rooms.game_state). */
  gameState: PublicGameState | null;
  /** The caller's personalized snapshot when a game is in progress. */
  playerSnapshot: PlayerGameSnapshot | null;
}

export interface GameRoomBackend {
  readonly currentUserId: string | undefined;
  createRoom(input: CreateRoomInput): Promise<LiveRoomSnapshot>;
  joinRoom(roomCode: string, playerName: string): Promise<LiveRoomSnapshot>;
  refresh(): Promise<LiveRoomSnapshot>;
  setReady(ready: boolean): Promise<LiveRoomSnapshot>;
  /** Host-only. The server shuffles and deals; no client state is uploaded. */
  startGame(startingPhaseId?: number): Promise<LiveRoomSnapshot>;
  /** Sends a validated command; the server replays it through the engine. */
  sendCommand(
    command: GameCommand,
    expectedVersion: number,
  ): Promise<LiveRoomSnapshot>;
  /** Refetches the caller's personalized snapshot (reconnect/resume/resync). */
  fetchSnapshot(): Promise<LiveRoomSnapshot>;
  leaveRoom(): Promise<void>;
  subscribe(listener: (snapshot: LiveRoomSnapshot) => void): () => void;
  dispose(): Promise<void>;
}

export function normalizeRoomCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}
