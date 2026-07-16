import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  CreateRoomInput,
  GameCard,
  GameCommand,
  GameRoomBackend,
  LiveRoomSnapshot,
  PlayerGameSnapshot,
  PublicGameState,
  RoomPlayer,
  RoomSnapshot,
  RoomStatus,
  TransportKind,
} from 'network-contracts';

import type { Json } from './database.types';
import {
  ensureAnonymousSession,
  type GameBackendClient,
} from './game-backend-client';

const ROOM_STATUSES = new Set<RoomStatus>(['lobby', 'playing', 'finished']);
const TRANSPORTS = new Set<TransportKind>([
  'auto',
  'wifi',
  'hotspot',
  'bluetooth',
]);
const PLAYER_TRANSPORTS = new Set<RoomPlayer['transport']>([
  'wifi',
  'hotspot',
  'bluetooth',
]);

interface EdgeGameResult {
  snapshot: PlayerGameSnapshot | null;
  stateVersion: number;
  duplicate?: boolean;
}

export function createGameRoomBackend(
  client: GameBackendClient,
): GameRoomBackend {
  let userId: string | undefined;
  let roomId: string | undefined;
  let lastRoom: RoomSnapshot | undefined;
  let channel: RealtimeChannel | undefined;
  let refreshPromise: Promise<LiveRoomSnapshot> | undefined;
  const listeners = new Set<(snapshot: LiveRoomSnapshot) => void>();

  async function authenticate(): Promise<string> {
    userId ??= await ensureAnonymousSession(client);
    return userId;
  }

  async function runRoomRpc(
    call: () => PromiseLike<{
      data: Json | null;
      error: { message: string } | null;
    }>,
  ): Promise<LiveRoomSnapshot> {
    const { data, error } = await call();
    if (error) throw new Error(error.message);
    const snapshot = parseLiveRoomSnapshot(data);
    lastRoom = snapshot.room;
    await adoptRoom(snapshot);
    return snapshot;
  }

  /** Invokes the authoritative `game` Edge Function and surfaces its error text. */
  async function invokeGame(body: Record<string, unknown>): Promise<EdgeGameResult> {
    await authenticate();
    const { data, error } = await client.functions.invoke('game', { body });
    if (error) {
      let message = error.message;
      const context = (error as { context?: unknown }).context;
      if (context && typeof (context as Response).json === 'function') {
        try {
          const payload = (await (context as Response).json()) as {
            error?: string;
          };
          if (payload?.error) message = payload.error;
        } catch {
          // Keep the transport-level message.
        }
      }
      throw new Error(message);
    }
    // Validate the server snapshot before it reaches the store (F-04).
    const raw = (data ?? {}) as {
      snapshot?: Json | null;
      stateVersion?: number;
      duplicate?: boolean;
    };
    const snapshot = raw.snapshot ? validatePlayerSnapshot(raw.snapshot) : null;
    return {
      snapshot,
      stateVersion: raw.stateVersion ?? snapshot?.stateVersion ?? 0,
      duplicate: raw.duplicate,
    };
  }

  async function ensureRoom(): Promise<RoomSnapshot> {
    if (lastRoom) return lastRoom;
    const snapshot = await refresh();
    return snapshot.room;
  }

  function buildLiveSnapshot(
    baseRoom: RoomSnapshot,
    result: EdgeGameResult,
  ): LiveRoomSnapshot {
    const snapshot = result.snapshot ?? null;
    const stateVersion = result.stateVersion ?? snapshot?.stateVersion ?? 0;
    return {
      roomId: requireRoomId(roomId),
      room: snapshot ? applySnapshotToRoom(baseRoom, snapshot) : baseRoom,
      stateVersion,
      gameState: null,
      playerSnapshot: snapshot,
    };
  }

  async function adoptRoom(snapshot: LiveRoomSnapshot): Promise<void> {
    const changedRoom = snapshot.roomId !== roomId;
    roomId = snapshot.roomId;
    lastRoom = snapshot.room;
    listeners.forEach((listener) => listener(snapshot));
    if (changedRoom) await subscribeToRoomChanges(snapshot.roomId);
  }

  async function subscribeToRoomChanges(targetRoomId: string): Promise<void> {
    if (channel) await client.removeChannel(channel);
    channel = client
      .channel(`game-room:${targetRoomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${targetRoomId}`,
        },
        requestRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_room_players',
          filter: `room_id=eq.${targetRoomId}`,
        },
        requestRefresh,
      )
      .subscribe((status) => {
        // Refetch authoritative state on (re)subscribe so a dropped Realtime
        // connection self-heals after reconnect.
        if (status === 'SUBSCRIBED') requestRefresh();
      });
  }

  function requestRefresh(): void {
    if (!roomId || refreshPromise) return;
    refreshPromise = refresh().finally(() => {
      refreshPromise = undefined;
    });
  }

  async function createRoom(input: CreateRoomInput): Promise<LiveRoomSnapshot> {
    await authenticate();
    return runRoomRpc(() =>
      client.rpc('create_game_room', {
        display_name: input.hostName,
        maximum_players: input.maxPlayers,
        requested_transport: input.transport,
      }),
    );
  }

  async function joinRoom(
    roomCode: string,
    playerName: string,
  ): Promise<LiveRoomSnapshot> {
    await authenticate();
    return runRoomRpc(() =>
      client.rpc('join_game_room', {
        room_code: roomCode,
        display_name: playerName,
      }),
    );
  }

  async function refresh(): Promise<LiveRoomSnapshot> {
    await authenticate();
    const targetRoomId = requireRoomId(roomId);
    const { data, error } = await client.rpc('get_game_room', {
      target_room_id: targetRoomId,
    });
    if (error) throw new Error(error.message);
    const roomSnapshot = parseLiveRoomSnapshot(data);
    lastRoom = roomSnapshot.room;

    let combined = roomSnapshot;
    if (roomSnapshot.room.status === 'playing') {
      try {
        const result = await invokeGame({ op: 'snapshot', roomId: targetRoomId });
        combined = {
          ...roomSnapshot,
          playerSnapshot: result.snapshot ?? null,
          stateVersion: result.stateVersion ?? roomSnapshot.stateVersion,
        };
      } catch {
        // A member-only room event without a personalized snapshot is still
        // useful for the lobby; keep the room snapshot.
      }
    }
    await adoptRoom(combined);
    return combined;
  }

  async function setReady(ready: boolean): Promise<LiveRoomSnapshot> {
    const targetRoomId = requireRoomId(roomId);
    return runRoomRpc(() =>
      client.rpc('set_game_room_ready', {
        target_room_id: targetRoomId,
        ready,
      }),
    );
  }

  async function startGame(
    startingPhaseId?: number,
  ): Promise<LiveRoomSnapshot> {
    const targetRoomId = requireRoomId(roomId);
    const baseRoom = await ensureRoom();
    const result = await invokeGame({
      op: 'start',
      roomId: targetRoomId,
      ...(startingPhaseId ? { startingPhaseId } : {}),
    });
    const snapshot = buildLiveSnapshot(baseRoom, result);
    await adoptRoom(snapshot);
    return snapshot;
  }

  async function sendCommand(
    command: GameCommand,
    expectedVersion: number,
  ): Promise<LiveRoomSnapshot> {
    const targetRoomId = requireRoomId(roomId);
    const baseRoom = await ensureRoom();
    const result = await invokeGame({
      op: 'command',
      roomId: targetRoomId,
      expectedVersion,
      command,
    });
    const snapshot = buildLiveSnapshot(baseRoom, result);
    await adoptRoom(snapshot);
    return snapshot;
  }

  async function fetchSnapshot(): Promise<LiveRoomSnapshot> {
    const targetRoomId = requireRoomId(roomId);
    const baseRoom = await ensureRoom();
    const result = await invokeGame({ op: 'snapshot', roomId: targetRoomId });
    const snapshot = buildLiveSnapshot(baseRoom, result);
    await adoptRoom(snapshot);
    return snapshot;
  }

  async function leaveRoom(): Promise<void> {
    if (!roomId) return;
    const { error } = await client.rpc('leave_game_room', {
      target_room_id: roomId,
    });
    if (error) throw new Error(error.message);
    roomId = undefined;
    lastRoom = undefined;
    if (channel) await client.removeChannel(channel);
    channel = undefined;
  }

  function subscribe(
    listener: (snapshot: LiveRoomSnapshot) => void,
  ): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  async function dispose(): Promise<void> {
    listeners.clear();
    if (channel) await client.removeChannel(channel);
    channel = undefined;
  }

  return {
    get currentUserId() {
      return userId;
    },
    createRoom,
    joinRoom,
    refresh,
    setReady,
    startGame,
    sendCommand,
    fetchSnapshot,
    leaveRoom,
    subscribe,
    dispose,
  };
}

function applySnapshotToRoom(
  room: RoomSnapshot,
  snapshot: PlayerGameSnapshot,
): RoomSnapshot {
  const counts = new Map(snapshot.players.map((p) => [p.id, p.cardCount]));
  return {
    ...room,
    status: snapshot.status === 'match-ended' ? 'finished' : 'playing',
    players: room.players.map((player) => ({
      ...player,
      cardsRemaining: counts.get(player.id) ?? player.cardsRemaining,
    })),
  };
}

export function parseLiveRoomSnapshot(value: Json | null): LiveRoomSnapshot {
  const root = asRecord(value, 'room snapshot');
  const room = asRecord(root['room'], 'room');
  const rawPlayers = Array.isArray(room['players']) ? room['players'] : [];
  const status = readString(room['status'], 'room status') as RoomStatus;
  const transport = readString(
    room['transport'],
    'room transport',
  ) as TransportKind;

  if (!ROOM_STATUSES.has(status)) throw new Error('Invalid room status.');
  if (!TRANSPORTS.has(transport)) throw new Error('Invalid room transport.');

  const rawGameState = root['gameState'];
  const gameState =
    rawGameState && typeof rawGameState === 'object' && !Array.isArray(rawGameState)
      ? (rawGameState as unknown as PublicGameState)
      : null;

  return {
    roomId: readString(root['roomId'], 'room id'),
    stateVersion: readNumber(root['stateVersion'], 'state version'),
    gameState,
    playerSnapshot: null,
    room: {
      code: readString(room['code'], 'room code'),
      maxPlayers: readNumber(room['maxPlayers'], 'maximum players'),
      hostId: readString(room['hostId'], 'host id'),
      status,
      transport,
      players: rawPlayers.map(parseRoomPlayer),
    },
  };
}

function parseRoomPlayer(value: Json): RoomPlayer {
  const player = asRecord(value, 'room player');
  const transport = readString(
    player['transport'],
    'player transport',
  ) as RoomPlayer['transport'];
  if (!PLAYER_TRANSPORTS.has(transport)) {
    throw new Error('Invalid player transport.');
  }
  const connection = readString(
    player['connection'],
    'player connection',
  ) as RoomPlayer['connection'];
  if (!['strong', 'good', 'weak', 'reconnecting'].includes(connection)) {
    throw new Error('Invalid player connection.');
  }
  return {
    id: readString(player['id'], 'player id'),
    name: readString(player['name'], 'player name'),
    seat: readNumber(player['seat'], 'player seat'),
    color: readString(player['color'], 'player color'),
    isHost: readBoolean(player['isHost'], 'host flag'),
    isReady: readBoolean(player['isReady'], 'ready flag'),
    cardsRemaining: readNumber(player['cardsRemaining'], 'cards remaining'),
    connection,
    transport,
  };
}

type SnapshotPlayer = PlayerGameSnapshot['players'][number];
type SnapshotMeld = SnapshotPlayer['laidMelds'][number];

function validateCard(value: Json): GameCard {
  const card = asRecord(value, 'card');
  const id = readString(card['id'], 'card id');
  const kind = readString(card['kind'], 'card kind');
  if (kind === 'number') {
    return { id, kind: 'number', value: readNumber(card['value'], 'card value') };
  }
  if (kind === 'wild') {
    const locked = card['lockedValue'];
    return locked == null
      ? { id, kind: 'wild' }
      : { id, kind: 'wild', lockedValue: readNumber(locked, 'wild value') };
  }
  throw new Error('Invalid card kind.');
}

function validateLaidMeld(value: Json): SnapshotMeld {
  const meld = asRecord(value, 'laid meld');
  return {
    id: readString(meld['id'], 'meld id'),
    ownerId: readString(meld['ownerId'], 'meld owner'),
    phaseId: readNumber(meld['phaseId'], 'meld phase'),
    operation: readString(meld['operation'], 'meld operation') as SnapshotMeld['operation'],
    cards: Array.isArray(meld['cards']) ? meld['cards'].map(validateCard) : [],
  };
}

function validatePublicPlayer(value: Json): SnapshotPlayer {
  const player = asRecord(value, 'snapshot player');
  return {
    id: readString(player['id'], 'player id'),
    name: readString(player['name'], 'player name'),
    seat: readNumber(player['seat'], 'player seat'),
    phaseId: readNumber(player['phaseId'], 'player phase'),
    score: readNumber(player['score'], 'player score'),
    cardCount: readNumber(player['cardCount'], 'player card count'),
    completedPhase: readBoolean(player['completedPhase'], 'completed phase flag'),
    laidMelds: Array.isArray(player['laidMelds'])
      ? player['laidMelds'].map(validateLaidMeld)
      : [],
  };
}

export function validatePlayerSnapshot(value: Json): PlayerGameSnapshot {
  const snapshot = asRecord(value, 'player snapshot');
  const status = readString(snapshot['status'], 'snapshot status');
  if (!['playing', 'round-ended', 'match-ended'].includes(status)) {
    throw new Error('Invalid snapshot status.');
  }
  const turnStep = readString(snapshot['turnStep'], 'turn step');
  if (!['draw', 'build'].includes(turnStep)) {
    throw new Error('Invalid turn step.');
  }
  if (!Array.isArray(snapshot['players']) || !Array.isArray(snapshot['myHand'])) {
    throw new Error('Invalid snapshot collections.');
  }
  const winner = snapshot['winnerId'];
  const discardTop = snapshot['discardTop'];
  return {
    gameId: readString(snapshot['gameId'], 'game id'),
    stateVersion: readNumber(snapshot['stateVersion'], 'state version'),
    viewerId: readString(snapshot['viewerId'], 'viewer id'),
    round: readNumber(snapshot['round'], 'round'),
    status: status as PlayerGameSnapshot['status'],
    activePlayerId: readString(snapshot['activePlayerId'], 'active player id'),
    activePlayerIndex: readNumber(snapshot['activePlayerIndex'], 'active player index'),
    turnStep: turnStep as PlayerGameSnapshot['turnStep'],
    deckCount: readNumber(snapshot['deckCount'], 'deck count'),
    discardCount: readNumber(snapshot['discardCount'], 'discard count'),
    discardTop: discardTop == null ? null : validateCard(discardTop),
    winnerId: winner == null ? null : readString(winner, 'winner id'),
    players: snapshot['players'].map(validatePublicPlayer),
    myHand: snapshot['myHand'].map(validateCard),
    actionLog: Array.isArray(snapshot['actionLog'])
      ? snapshot['actionLog'].map((entry) => {
          const log = asRecord(entry, 'action log');
          return {
            id: readString(log['id'], 'log id'),
            playerId: readString(log['playerId'], 'log player'),
            message: readString(log['message'], 'log message'),
          };
        })
      : [],
  };
}

function asRecord(value: Json | undefined | null, label: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Supabase returned an invalid ${label}.`);
  }
  return value;
}

function readString(value: Json | undefined, label: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid ${label}.`);
  return value;
}

function readNumber(value: Json | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function readBoolean(value: Json | undefined, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${label}.`);
  return value;
}

function requireRoomId(roomId: string | undefined): string {
  if (!roomId) throw new Error('Join or create a room first.');
  return roomId;
}
