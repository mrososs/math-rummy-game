import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export interface GameBackendConfig {
  url: string;
  publishableKey: string;
}

export type GameBackendClient = SupabaseClient<Database>;

export function createGameBackendClient(
  config: GameBackendConfig,
): GameBackendClient {
  if (!config.url || !config.publishableKey) {
    throw new Error('Supabase URL and publishable key are required.');
  }

  return createClient<Database>(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    },
    realtime: {
      params: { eventsPerSecond: 5 },
    },
  });
}

export async function ensureAnonymousSession(
  client: GameBackendClient,
): Promise<string> {
  const { data: sessionData } = await client.auth.getSession();
  if (sessionData.session?.user.id) return sessionData.session.user.id;

  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error('Supabase did not return an anonymous user.');
  return data.user.id;
}
