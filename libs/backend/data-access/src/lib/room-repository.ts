import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  CreateRoomInput,
  GameRoomBackend,
  LiveRoomSnapshot,
  RoomPlayer,
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

export function createGameRoomBackend(
  client: GameBackendClient,
): GameRoomBackend {
  let userId: string | undefined;
  let roomId: string | undefined;
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
    await adoptRoom(snapshot);
    return snapshot;
  }

  async function adoptRoom(snapshot: LiveRoomSnapshot): Promise<void> {
    const changedRoom = snapshot.roomId !== roomId;
    roomId = snapshot.roomId;
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
      .subscribe();
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
    return runRoomRpc(() =>
      client.rpc('get_game_room', { target_room_id: targetRoomId }),
    );
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

  async function startGame(initialState: unknown): Promise<LiveRoomSnapshot> {
    const targetRoomId = requireRoomId(roomId);
    return runRoomRpc(() =>
      client.rpc('start_game_room', {
        target_room_id: targetRoomId,
        initial_state: toJson(initialState),
      }),
    );
  }

  async function updateGameState(
    expectedVersion: number,
    nextState: unknown,
  ): Promise<LiveRoomSnapshot> {
    const targetRoomId = requireRoomId(roomId);
    return runRoomRpc(() =>
      client.rpc('update_game_room_state', {
        target_room_id: targetRoomId,
        expected_version: expectedVersion,
        next_state: toJson(nextState),
      }),
    );
  }

  async function leaveRoom(): Promise<void> {
    if (!roomId) return;
    const { error } = await client.rpc('leave_game_room', {
      target_room_id: roomId,
    });
    if (error) throw new Error(error.message);
    roomId = undefined;
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
    updateGameState,
    leaveRoom,
    subscribe,
    dispose,
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

  return {
    roomId: readString(root['roomId'], 'room id'),
    stateVersion: readNumber(root['stateVersion'], 'state version'),
    gameState: root['gameState'] === undefined ? null : root['gameState'],
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

function toJson(value: unknown): Json {
  if (value === undefined) throw new Error('A game state is required.');
  return JSON.parse(JSON.stringify(value)) as Json;
}
