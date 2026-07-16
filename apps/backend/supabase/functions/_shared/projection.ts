// Turns the authoritative GameMatch into the sanitized views that leave the
// server. NEVER include deck order, opponent hands, or the shuffle seed here.
import type { GameMatch } from './game-engine.ts';
import type {
  PublicGameState,
  PublicPlayerState,
  PlayerGameSnapshot,
} from './protocol.ts';

export function toPublicPlayers(match: GameMatch): PublicPlayerState[] {
  return match.players.map((player) => ({
    id: player.id,
    name: player.name,
    seat: player.seat,
    phaseId: player.phaseId,
    score: player.score,
    cardCount: player.hand.length,
    completedPhase: player.completedPhase,
    // Laid melds are face-up on the table, so they are public.
    laidMelds: player.laidMelds.map((meld) => ({ ...meld })),
  }));
}

export function toPublicProjection(match: GameMatch): PublicGameState {
  const active = match.players[match.activePlayerIndex];
  const discardTop =
    match.discardPile.length > 0
      ? match.discardPile[match.discardPile.length - 1]
      : null;
  return {
    gameId: match.id,
    round: match.round,
    status: match.status,
    activePlayerId: active?.id ?? '',
    activePlayerIndex: match.activePlayerIndex,
    turnStep: match.turnStep,
    deckCount: match.deck.length,
    discardTop,
    discardCount: match.discardPile.length,
    winnerId: match.winnerId ?? null,
    players: toPublicPlayers(match),
    actionLog: match.actionLog.map((entry) => ({ ...entry })),
  };
}

export function toPlayerSnapshot(
  match: GameMatch,
  viewerId: string,
  stateVersion: number,
): PlayerGameSnapshot {
  const me = match.players.find((player) => player.id === viewerId);
  return {
    ...toPublicProjection(match),
    stateVersion,
    viewerId,
    myHand: me ? me.hand.map((card) => ({ ...card })) : [],
  };
}
