import type { GameBackendClient } from './game-backend-client';
import type { Json } from './database.types';

export interface MatchPlayerSummary {
  userId?: string;
  displayName: string;
  seat: number;
  isHost: boolean;
  finalPhase: number;
  score: number;
  placement?: number;
}

export interface SaveMatchSummaryInput {
  hostUserId: string;
  roomCode: string;
  transport: 'wifi' | 'hotspot' | 'bluetooth';
  winnerUserId?: string;
  startedAt: string;
  metadata?: Json;
  players: readonly MatchPlayerSummary[];
}

export interface MatchHistoryEntry {
  id: string;
  roomCode: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  transport: 'wifi' | 'hotspot' | 'bluetooth';
  winnerUserId?: string;
  startedAt: string;
  endedAt?: string;
  metadata: Json;
  players: readonly MatchPlayerSummary[];
}

export interface SavedMatchState {
  matchId: string;
  hostUserId: string;
  stateVersion: number;
  encryptedState: string;
  updatedAt: string;
}

export async function saveMatchSummary(
  client: GameBackendClient,
  input: SaveMatchSummaryInput,
): Promise<string> {
  const { data, error } = await client.rpc('record_completed_match', {
    completed_room_code: input.roomCode,
    requested_transport: input.transport,
    winning_user_id: input.winnerUserId ?? null,
    match_started_at: input.startedAt,
    match_metadata: input.metadata ?? {},
    player_summaries: input.players.map((player) => ({
      userId: player.userId ?? '',
      displayName: player.displayName,
      seat: player.seat,
      isHost: player.isHost,
      finalPhase: player.finalPhase,
      score: player.score,
      placement: player.placement ?? '',
    })),
  });
  if (error) throw error;
  return data;
}

export async function listMatchHistory(
  client: GameBackendClient,
  limit = 20,
): Promise<MatchHistoryEntry[]> {
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
  const { data: matches, error: matchesError } = await client
    .from('matches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (matchesError) throw matchesError;
  if (!matches.length) return [];

  const { data: players, error: playersError } = await client
    .from('match_players')
    .select('*')
    .in(
      'match_id',
      matches.map((match) => match.id),
    )
    .order('seat', { ascending: true });
  if (playersError) throw playersError;

  return matches.map((match) => ({
    id: match.id,
    roomCode: match.room_code,
    status: match.status,
    transport: match.transport,
    winnerUserId: match.winner_user_id ?? undefined,
    startedAt: match.started_at,
    endedAt: match.ended_at ?? undefined,
    metadata: match.metadata,
    players: players
      .filter((player) => player.match_id === match.id)
      .map((player) => ({
        userId: player.user_id ?? undefined,
        displayName: player.display_name,
        seat: player.seat,
        isHost: player.is_host,
        finalPhase: player.final_phase,
        score: player.score,
        placement: player.placement ?? undefined,
      })),
  }));
}

export async function saveMatchState(
  client: GameBackendClient,
  input: Omit<SavedMatchState, 'updatedAt'>,
): Promise<void> {
  const { error } = await client.from('match_saves').upsert({
    match_id: input.matchId,
    host_user_id: input.hostUserId,
    state_version: input.stateVersion,
    encrypted_state: input.encryptedState,
  });
  if (error) throw error;
}

export async function loadMatchState(
  client: GameBackendClient,
  matchId: string,
): Promise<SavedMatchState | undefined> {
  const { data, error } = await client
    .from('match_saves')
    .select('*')
    .eq('match_id', matchId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return {
    matchId: data.match_id,
    hostUserId: data.host_user_id,
    stateVersion: data.state_version,
    encryptedState: data.encrypted_state,
    updatedAt: data.updated_at,
  };
}

export async function deleteMatchState(
  client: GameBackendClient,
  matchId: string,
): Promise<void> {
  const { error } = await client
    .from('match_saves')
    .delete()
    .eq('match_id', matchId);
  if (error) throw error;
}
