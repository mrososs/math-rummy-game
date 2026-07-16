<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonButton, IonIcon } from '@ionic/vue';
import { closeOutline, trashOutline } from 'ionicons/icons';
import { getPhase } from 'game-domain';
import type {
  DrawSource,
  EngineMeldInput,
  GameCard,
  GameMatch,
  MathOperation,
  PhaseDefinition,
} from 'game-domain';
import type { RoomSnapshot } from 'network-contracts';
import type { ProfileStats } from 'backend-data-access';
import GameBoard from './GameBoard.vue';
import GameHud from './GameHud.vue';
import PhaseWorkbench from './PhaseWorkbench.vue';
import PlayerHand from './PlayerHand.vue';
import ScoreboardModal from './ScoreboardModal.vue';
import type { ScoreEntry } from './scoreboard';
import { getAccountBackend } from '../../app/game-backend';

interface StagedMeldDetails extends EngineMeldInput {
  cards: readonly GameCard[];
}

const props = defineProps<{
  room: RoomSnapshot;
  match: GameMatch;
  currentPlayerId: string;
  thinkingPlayerId?: string;
  phase: PhaseDefinition;
  hand: readonly GameCard[];
  selectedCards: readonly GameCard[];
  selectedIds: readonly string[];
  stagedIds: readonly string[];
  stagedMelds: readonly StagedMeldDetails[];
  selectedOperation: MathOperation;
  feedbackMessage: string;
  candidateMessage: string;
  canDraw: boolean;
  canSelectCards: boolean;
  canStageMeld: boolean;
  canSubmitPhase: boolean;
  canDiscard: boolean;
  canHit: boolean;
  phaseComplete: boolean;
}>();

const emit = defineEmits<{
  toggleCard: [cardId: string];
  draw: [source: DrawSource];
  updateOperation: [operation: MathOperation];
  stageMeld: [];
  unstageMeld: [meldId: string];
  submitPhase: [];
  discard: [];
  clearSelection: [];
  hit: [targetPlayerId: string, meldId: string];
  setWildValue: [cardId: string, value: number];
}>();

const activePlayer = computed(
  () => props.match.players[props.match.activePlayerIndex],
);
const allLaidMelds = computed(() =>
  props.match.players.flatMap((player) => player.laidMelds),
);
const cardCounts = computed(() =>
  Object.fromEntries(
    props.match.players.map((player) => [player.id, player.hand.length]),
  ),
);
const turnInstruction = computed(() => {
  if (props.match.turnStep === 'draw') {
    return 'Draw one card to start your turn.';
  }
  if (props.selectedIds.length === 0) {
    if (props.phaseComplete) {
      return 'Select cards and an operation, then tap your phase or another player phase.';
    }
    return 'To end your turn, select one unstaged card from your hand.';
  }
  if (props.phaseComplete && props.selectedIds.length > 1) {
    return 'Tap a compatible completed phase to hit with these cards.';
  }
  if (props.phaseComplete && props.canHit) {
    return 'Tap a compatible phase to hit, or discard this card to end your turn.';
  }
  if (props.canDiscard) {
    return 'Selected card is ready. Discard it to end your turn.';
  }
  return 'Keep exactly one unstaged card selected to end your turn.';
});
const turnGuideTitle = computed(() =>
  props.phaseComplete ? 'Hit or end your turn' : 'End your turn',
);

const showScores = ref(false);
const profileStats = ref<Map<string, ProfileStats>>(new Map());
const scoreEntries = computed<ScoreEntry[]>(() => {
  const colorById = new Map(
    props.room.players.map((player) => [player.id, player.color] as const),
  );
  return [...props.match.players]
    .map((player) => {
      const stats = profileStats.value.get(player.id);
      return {
        id: player.id,
        name: player.name,
        phaseId: player.phaseId,
        phaseTitle: getPhase(player.phaseId).shortTitle,
        score: player.score,
        cardsRemaining: player.hand.length,
        color: colorById.get(player.id) ?? '#475569',
        isHost: player.id === props.room.hostId,
        isYou: player.id === props.currentPlayerId,
        isWinner: player.id === props.match.winnerId,
        gamesWon: stats?.gamesWon,
        gamesPlayed: stats?.gamesPlayed,
      };
    })
    .sort(
      (first, second) =>
        second.phaseId - first.phaseId ||
        first.score - second.score ||
        first.name.localeCompare(second.name),
    );
});

async function openScores(): Promise<void> {
  showScores.value = true;
  const account = getAccountBackend();
  if (!account) return;
  try {
    const stats = await account.fetchProfiles(
      props.match.players.map((player) => player.id),
    );
    profileStats.value = new Map(stats.map((stat) => [stat.id, stat]));
  } catch {
    // Show the in-match scores even if lifetime stats can't be loaded.
  }
}

function handleHit(targetPlayerId: string, meldId: string): void {
  emit('hit', targetPlayerId, meldId);
}

function handleWildValue(cardId: string, value: number): void {
  emit('setWildValue', cardId, value);
}
</script>

<template>
  <div class="game-table">
    <GameHud
      class="game-table__hud"
      :phase="props.phase"
      :round="props.match.round"
      :active-player-name="activePlayer.name"
      :is-your-turn="activePlayer.id === props.currentPlayerId"
      :turn-step="props.match.turnStep"
      @open-scores="openScores"
    />

    <GameBoard
      class="game-table__board"
      :room="props.room"
      :current-player-id="props.currentPlayerId"
      :active-player-id="activePlayer.id"
      :thinking-player-id="props.thinkingPlayerId"
      :discard-top="props.match.discardPile.at(-1)"
      :deck-count="props.match.deck.length"
      :can-draw="props.canDraw"
      :can-hit="props.canHit"
      :laid-melds="allLaidMelds"
      :card-counts="cardCounts"
      @draw="emit('draw', $event)"
      @hit="handleHit"
    />

    <p
      class="game-table__feedback"
      aria-live="polite"
    >
      <span aria-hidden="true" />
      {{ props.feedbackMessage }}
    </p>

    <PlayerHand
      class="game-table__hand"
      :cards="props.hand"
      :selected-ids="props.selectedIds"
      :staged-ids="props.stagedIds"
      :selectable="props.canSelectCards"
      @toggle-card="emit('toggleCard', $event)"
    />

    <PhaseWorkbench
      class="game-table__workbench"
      :phase="props.phase"
      :selected-cards="props.selectedCards"
      :staged-melds="props.stagedMelds"
      :selected-operation="props.selectedOperation"
      :validation-message="props.candidateMessage"
      :can-stage="props.canStageMeld"
      :can-submit="props.canSubmitPhase"
      :phase-complete="props.phaseComplete"
      @update-operation="emit('updateOperation', $event)"
      @stage="emit('stageMeld')"
      @unstage="emit('unstageMeld', $event)"
      @submit="emit('submitPhase')"
      @set-wild-value="handleWildValue"
    />

    <nav
      class="turn-actions safe-area-block"
      aria-label="Turn controls"
    >
      <p
        class="turn-actions__guide"
        aria-live="polite"
      >
        <strong>{{ turnGuideTitle }}</strong>
        <span>{{ turnInstruction }}</span>
      </p>
      <IonButton
        fill="clear"
        :disabled="props.selectedIds.length === 0"
        aria-label="Clear selected cards"
        @click="emit('clearSelection')"
      >
        <IonIcon
          slot="start"
          :icon="closeOutline"
        />
        Clear
      </IonButton>
      <IonButton
        class="danger-button"
        :disabled="!props.canDiscard"
        aria-label="Discard selected card and end turn"
        @click="emit('discard')"
      >
        <IonIcon
          slot="start"
          :icon="trashOutline"
        />
        End turn · discard
      </IonButton>
    </nav>

    <ScoreboardModal
      :is-open="showScores"
      :entries="scoreEntries"
      @close="showScores = false"
    />
  </div>
</template>

<style scoped>
.game-table {
  container-type: inline-size;
  display: grid;
  min-height: 100%;
  grid-template-rows: auto auto auto auto auto auto;
  color: #f4f8fb;
}

.game-table__feedback {
  display: flex;
  min-height: 2.1rem;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  margin: 0;
  padding: 0.35rem 1rem 0.55rem;
  color: #b8cadd;
  font-size: 0.67rem;
  text-align: center;
}

.game-table__feedback span {
  width: 0.45rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--color-success);
  box-shadow: 0 0 0 0.2rem rgb(46 125 50 / 18%);
}

.turn-actions {
  position: sticky;
  bottom: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(7rem, 0.7fr) minmax(11rem, 1.3fr);
  gap: 0.55rem;
  padding-top: 0.75rem;
  border-top: 1px solid #c5d2de;
  background: var(--color-surface);
  box-shadow: 0 -0.85rem 1.6rem -1.2rem rgb(4 24 43 / 75%);
  color: var(--color-navy);
}

.turn-actions__guide {
  display: grid;
  grid-column: 1 / -1;
  gap: 0.15rem;
  margin: 0;
}

.turn-actions__guide strong {
  font-family: var(--font-display);
  font-size: 0.78rem;
}

.turn-actions__guide span {
  color: var(--color-text-muted);
  font-size: 0.67rem;
  line-height: 1.35;
}

.turn-actions ion-button {
  min-height: 3rem;
  margin: 0;
  --border-radius: 0.75rem;
}

.turn-actions ion-button:first-child {
  --color: #40566a;
}

@media (orientation: landscape) and (min-width: 48rem) {
  .game-table {
    grid-template-columns: minmax(30rem, 2.1fr) minmax(18rem, 0.9fr);
    grid-template-rows: auto minmax(15rem, 1fr) auto auto;
  }

  .game-table__hud {
    grid-column: 1 / -1;
  }

  .game-table__board {
    grid-row: 2;
    grid-column: 1;
  }

  .game-table__feedback {
    grid-row: 3;
    grid-column: 1;
  }

  .game-table__hand {
    grid-row: 4;
    grid-column: 1;
  }

  .game-table__workbench {
    grid-row: 2 / 4;
    grid-column: 2;
  }

  .turn-actions {
    grid-row: 4;
    grid-column: 2;
    align-content: end;
    padding: 0.8rem max(0.8rem, env(safe-area-inset-right))
      max(0.8rem, env(safe-area-inset-bottom));
    background: #eef3f8;
  }
}

/* Tablets / large phones in portrait: keep the single column readable by
   centering it instead of stretching edge-to-edge. */
@media (orientation: portrait) and (min-width: 40rem) {
  .game-table {
    max-width: 40rem;
    margin-inline: auto;
    width: 100%;
  }
}

/* Wider landscape tablets: give the board a bit more room but cap it so cards
   and the workbench don't sprawl. */
@media (orientation: landscape) and (min-width: 64rem) {
  .game-table {
    max-width: 72rem;
    margin-inline: auto;
    width: 100%;
  }
}
</style>
