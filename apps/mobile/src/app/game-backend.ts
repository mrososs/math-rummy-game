import {
  createAccountBackend,
  createGameBackendClient,
  createGameRoomBackend,
  type AccountBackend,
} from 'backend-data-access';
import type { GameRoomBackend } from 'network-contracts';

const PLACEHOLDER_KEY = 'replace-with-local-or-project-publishable-key';

let accountBackend: AccountBackend | undefined;

/** The account backend (settings + profile stats), available once online. */
export function getAccountBackend(): AccountBackend | undefined {
  return accountBackend;
}

/**
 * Builds the online backend, or returns undefined to run single-device offline.
 *
 * F-07: a production build with missing Supabase config used to silently fall
 * back to offline, hiding a broken deploy. Now production fails fast unless
 * offline mode is opted into explicitly via VITE_OFFLINE_MODE=true.
 */
export function createConfiguredGameBackend(): GameRoomBackend | undefined {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const explicitOffline = import.meta.env.VITE_OFFLINE_MODE === 'true';
  const configured = Boolean(
    url && publishableKey && publishableKey !== PLACEHOLDER_KEY,
  );

  if (explicitOffline) {
    logTransport('Offline mode is on (VITE_OFFLINE_MODE=true).');
    return undefined;
  }

  if (!configured) {
    if (import.meta.env.PROD) {
      throw new Error(
        'Supabase configuration is missing. Set VITE_SUPABASE_URL and ' +
          'VITE_SUPABASE_PUBLISHABLE_KEY, or set VITE_OFFLINE_MODE=true to run ' +
          'offline intentionally.',
      );
    }
    logTransport('Supabase is not configured — running offline (dev only).');
    return undefined;
  }

  logTransport('Online multiplayer enabled.');
  const client = createGameBackendClient({
    url: url as string,
    publishableKey: publishableKey as string,
  });
  accountBackend = createAccountBackend(client);
  return createGameRoomBackend(client);
}

function logTransport(message: string): void {
  if (import.meta.env.DEV) {
    // Surface the active transport mode in development diagnostics.
    console.info(`[transport] ${message}`);
  }
}
