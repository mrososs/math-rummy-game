import {
  createGameBackendClient,
  createGameRoomBackend,
} from 'backend-data-access';
import type { GameRoomBackend } from 'network-contracts';

export function createConfiguredGameBackend(): GameRoomBackend | undefined {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (
    !url ||
    !publishableKey ||
    publishableKey === 'replace-with-local-or-project-publishable-key'
  ) {
    return undefined;
  }

  return createGameRoomBackend(
    createGameBackendClient({ url, publishableKey }),
  );
}
