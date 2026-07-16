// Service-role access to the authoritative state. These wrap the
// service_role-only RPCs added in the authoritative_multiplayer migration.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { HttpError } from './http.ts';
import type { GameMatch } from './game-engine.ts';
import type { PublicGameState } from './protocol.ts';

export interface AuthoritativeRoomPlayer {
  id: string;
  name: string;
  seat: number;
  isReady: boolean;
  isHost: boolean;
}

export interface AuthoritativeState {
  roomId: string;
  roomStatus: string;
  hostId: string;
  maxPlayers: number;
  stateVersion: number;
  seed: string | null;
  state: GameMatch | null;
  players: AuthoritativeRoomPlayer[];
}

let cachedClient: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new HttpError(500, 'Server database access is misconfigured.', 'CONFIG');
  }
  cachedClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export async function readAuthoritativeState(
  roomId: string,
): Promise<AuthoritativeState> {
  const { data, error } = await adminClient().rpc('read_authoritative_game_state', {
    target_room_id: roomId,
  });
  if (error) throw new HttpError(500, error.message, 'DB_READ');
  if (!data) throw new HttpError(404, 'Room not found.', 'ROOM_NOT_FOUND');
  return data as AuthoritativeState;
}

/** Returns the version an actionId already produced, or null if never applied. */
export async function peekCommandVersion(
  roomId: string,
  actionId: string,
): Promise<number | null> {
  const { data, error } = await adminClient().rpc('peek_command_version', {
    target_room_id: roomId,
    action_id: actionId,
  });
  if (error) throw new HttpError(500, error.message, 'DB_READ');
  return (data as number | null) ?? null;
}

export async function commitStart(params: {
  roomId: string;
  hostId: string;
  privateState: GameMatch;
  publicState: PublicGameState;
  seed: string;
}): Promise<number> {
  const { data, error } = await adminClient().rpc('commit_game_start', {
    target_room_id: params.roomId,
    host_id: params.hostId,
    private_state: params.privateState,
    public_state: params.publicState,
    game_seed: params.seed,
  });
  if (error) throw mapDbError(error);
  return (data as { stateVersion: number }).stateVersion;
}

export async function commitCommand(params: {
  roomId: string;
  expectedVersion: number;
  actionId: string;
  actorId: string;
  commandType: string;
  privateState: GameMatch;
  publicState: PublicGameState;
  seed: string;
  status: string;
}): Promise<{ stateVersion: number; duplicate: boolean }> {
  const { data, error } = await adminClient().rpc('commit_game_command', {
    target_room_id: params.roomId,
    expected_version: params.expectedVersion,
    action_id: params.actionId,
    actor_id: params.actorId,
    command_type: params.commandType,
    next_private_state: params.privateState,
    next_public_state: params.publicState,
    next_seed: params.seed,
    next_status: params.status,
  });
  if (error) throw mapDbError(error);
  return data as { stateVersion: number; duplicate: boolean };
}

export async function logRejectedCommand(params: {
  roomId: string;
  actionId: string;
  actorId: string;
  commandType: string;
  reason: string;
}): Promise<void> {
  const { error } = await adminClient().rpc('log_rejected_command', {
    target_room_id: params.roomId,
    action_id: params.actionId,
    actor_id: params.actorId,
    command_type: params.commandType,
    reason: params.reason,
  });
  // Telemetry failures must never mask the real command outcome.
  if (error) console.error('log_rejected_command failed', error.message);
}

/** Postgres errcodes raised by the commit functions map to client statuses. */
function mapDbError(error: { code?: string; message: string }): HttpError {
  if (error.code === '40001') return new HttpError(409, error.message, 'VERSION_CONFLICT');
  if (error.code === 'P0002') return new HttpError(409, error.message, 'NOT_STARTED');
  if (error.code === '42501') return new HttpError(403, error.message, 'FORBIDDEN');
  return new HttpError(500, error.message, 'DB_WRITE');
}
