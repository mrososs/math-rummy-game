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
}
