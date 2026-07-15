import { defineStore } from 'pinia';
import type { BotDifficulty } from 'game-domain';

export type BotTurnSpeed = 'quick' | 'relaxed';

export interface GameSettings {
  playerName: string;
  botCount: number;
  botDifficulty: BotDifficulty;
  botTurnSpeed: BotTurnSpeed;
  showHints: boolean;
  reducedMotion: boolean;
}

const STORAGE_KEY = 'math-rummy-settings-v1';
const DEFAULT_SETTINGS: GameSettings = {
  playerName: 'Maya',
  botCount: 2,
  botDifficulty: 'standard',
  botTurnSpeed: 'quick',
  showHints: true,
  reducedMotion: false,
};

export const useSettingsStore = defineStore('game-settings', {
  state: (): GameSettings => loadSettings(),
  actions: {
    saveSettings(settings: GameSettings): void {
      this.$patch({
        ...settings,
        playerName: settings.playerName.trim().slice(0, 24) || 'Player',
        botCount: Math.min(5, Math.max(1, Math.round(settings.botCount))),
      });
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state));
      }
      this.applyPreferences();
    },
    applyPreferences(): void {
      if (typeof document === 'undefined') return;
      document.documentElement.dataset.motion = this.reducedMotion
        ? 'reduced'
        : 'full';
    },
  },
});

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
