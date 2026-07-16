export interface ScoreEntry {
  id: string;
  name: string;
  phaseId: number;
  /** The objective of the player's current phase, e.g. "Two sums of 10". */
  phaseTitle: string;
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
