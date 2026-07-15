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

export interface LiveRoomSnapshot {
  roomId: string;
  room: RoomSnapshot;
  stateVersion: number;
  gameState: unknown | null;
}

export interface GameRoomBackend {
  readonly currentUserId: string | undefined;
  createRoom(input: CreateRoomInput): Promise<LiveRoomSnapshot>;
  joinRoom(roomCode: string, playerName: string): Promise<LiveRoomSnapshot>;
  refresh(): Promise<LiveRoomSnapshot>;
  setReady(ready: boolean): Promise<LiveRoomSnapshot>;
  startGame(initialState: unknown): Promise<LiveRoomSnapshot>;
  updateGameState(
    expectedVersion: number,
    nextState: unknown,
  ): Promise<LiveRoomSnapshot>;
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
