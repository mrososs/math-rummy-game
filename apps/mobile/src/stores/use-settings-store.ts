import { defineStore } from 'pinia';
import type { BotDifficulty } from 'game-domain';
import { getAccountBackend } from '../app/game-backend';
import { setSoundEnabled } from '../composables/useSound';

export type BotTurnSpeed = 'quick' | 'relaxed';

export interface GameSettings {
  playerName: string;
  botCount: number;
  botDifficulty: BotDifficulty;
  botTurnSpeed: BotTurnSpeed;
  showHints: boolean;
  reducedMotion: boolean;
  soundEnabled: boolean;
}

export interface SaveResult {
  ok: boolean;
  /** True when the change also reached Supabase (false = local-only). */
  synced: boolean;
  error?: string;
}

const STORAGE_KEY = 'math-rummy-settings-v1';
const DEFAULT_SETTINGS: GameSettings = {
  playerName: 'Maya',
  botCount: 2,
  botDifficulty: 'standard',
  botTurnSpeed: 'quick',
  showHints: true,
  reducedMotion: false,
  soundEnabled: true,
};

export const useSettingsStore = defineStore('game-settings', {
  state: (): GameSettings => loadSettings(),
  actions: {
    /**
     * Persist settings locally (always) and to Supabase when online. Returns
     * whether the cloud save succeeded so the UI can show a toast.
     */
    async saveSettings(settings: GameSettings): Promise<SaveResult> {
      this.$patch(normalize(settings));
      persistLocal(this.$state);
      this.applyPreferences();

      const account = getAccountBackend();
      if (!account) return { ok: true, synced: false };
      try {
        await account.saveSettings({ ...this.$state });
        return { ok: true, synced: true };
      } catch (error) {
        return {
          ok: false,
          synced: false,
          error:
            error instanceof Error
              ? error.message
              : 'Could not save settings to the cloud.',
        };
      }
    },
    /** Load cloud settings on startup, if any; falls back to local silently. */
    async hydrateFromRemote(): Promise<void> {
      const account = getAccountBackend();
      if (!account) return;
      try {
        const remote = await account.loadSettings();
        if (remote) {
          this.$patch(normalize({ ...this.$state, ...remote }));
          persistLocal(this.$state);
          this.applyPreferences();
        }
      } catch {
        // Keep local settings if the cloud is unreachable.
      }
    },
    applyPreferences(): void {
      setSoundEnabled(this.soundEnabled);
      if (typeof document === 'undefined') return;
      document.documentElement.dataset.motion = this.reducedMotion
        ? 'reduced'
        : 'full';
    },
  },
});

function normalize(input: Partial<GameSettings>): GameSettings {
  const merged = { ...DEFAULT_SETTINGS, ...input };
  return {
    playerName: String(merged.playerName ?? '').trim().slice(0, 24) || 'Player',
    botCount: Math.min(
      5,
      Math.max(1, Math.round(Number(merged.botCount) || DEFAULT_SETTINGS.botCount)),
    ),
    botDifficulty: merged.botDifficulty ?? DEFAULT_SETTINGS.botDifficulty,
    botTurnSpeed: merged.botTurnSpeed ?? DEFAULT_SETTINGS.botTurnSpeed,
    showHints: Boolean(merged.showHints),
    reducedMotion: Boolean(merged.reducedMotion),
    soundEnabled: Boolean(merged.soundEnabled),
  };
}

function persistLocal(settings: GameSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings(): GameSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as Partial<GameSettings> | null;
    return saved ? { ...DEFAULT_SETTINGS, ...saved } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
