import type { Json } from './database.types';
import {
  ensureAnonymousSession,
  type GameBackendClient,
} from './game-backend-client';

export interface ProfileStats {
  id: string;
  displayName: string;
  gamesPlayed: number;
  gamesWon: number;
}

/** Per-user account data that lives outside a single game room. */
export interface AccountBackend {
  loadSettings(): Promise<Record<string, unknown> | null>;
  saveSettings(data: Record<string, unknown>): Promise<void>;
  fetchProfiles(ids: readonly string[]): Promise<ProfileStats[]>;
}

export function createAccountBackend(client: GameBackendClient): AccountBackend {
  async function loadSettings(): Promise<Record<string, unknown> | null> {
    const userId = await ensureAnonymousSession(client);
    const { data, error } = await client
      .from('user_settings')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const value = data?.data;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  async function saveSettings(data: Record<string, unknown>): Promise<void> {
    const userId = await ensureAnonymousSession(client);
    const { error } = await client
      .from('user_settings')
      .upsert(
        { user_id: userId, data: data as unknown as Json },
        { onConflict: 'user_id' },
      );
    if (error) throw new Error(error.message);
  }

  async function fetchProfiles(
    ids: readonly string[],
  ): Promise<ProfileStats[]> {
    const unique = [...new Set(ids)].filter(Boolean);
    if (!unique.length) return [];
    await ensureAnonymousSession(client);
    const { data, error } = await client
      .from('profiles')
      .select('id, display_name, games_played, games_won')
      .in('id', unique);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      gamesPlayed: row.games_played,
      gamesWon: row.games_won,
    }));
  }

  return { loadSettings, saveSettings, fetchProfiles };
}
