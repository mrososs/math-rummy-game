export interface ScoreEntry {
  id: string;
  name: string;
  phaseId: number;
  score: number;
  cardsRemaining: number;
  color: string;
  isHost: boolean;
  isYou: boolean;
  isWinner: boolean;
  /** Lifetime record from Supabase profiles (undefined until loaded/offline). */
  gamesWon?: number;
  gamesPlayed?: number;
}
