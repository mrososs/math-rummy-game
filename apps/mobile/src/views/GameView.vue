<script setup lang="ts">
import { computed, onBeforeMount, watch } from 'vue';
import { IonContent, IonPage, IonSpinner, IonToast } from '@ionic/vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import type { DrawSource, GameMatch, MathOperation } from 'game-domain';
import { useGameStore } from 'game-state';
import { useRoomStore } from 'room-state';
import GameTable from '../components/game/GameTable.vue';
import MatchResultPanel from '../components/game/MatchResultPanel.vue';
import { useBotMatch } from '../composables/useBotMatch';
import { useSettingsStore } from '../stores/use-settings-store';

const route = useRoute();
const router = useRouter();
const roomStore = useRoomStore();
const gameStore = useGameStore();
const settingsStore = useSettingsStore();
const isBotMode = computed(() => route.query.mode === 'bots');
const { thinkingBotId, thinkingBotName } = useBotMatch(isBotMode);
const { errorMessage, gameState, room, currentPlayerId } =
  storeToRefs(roomStore);
const {
  match,
  currentPhase,
  currentHand,
  currentPlayer,
  selectedCards,
  selectedCardIds,
  stagedCardIds,
  stagedMeldDetails,
  selectedOperation,
  feedbackMessage,
  candidateValidation,
  canDraw,
  canSelectCards,
  canStageMeld,
  canSubmitPhase,
  canDiscard,
  canHit,
} = storeToRefs(gameStore);
const winnerName = computed(() => {
  const currentMatch = match.value;
  if (!currentMatch?.winnerId) return undefined;
  return currentMatch.players.find(
    (player) => player.id === currentMatch.winnerId,
  )?.name;
});

onBeforeMount(() => {
  if (isBotMode.value && route.query.new === '1') {
    roomStore.setupBotRoom(settingsStore.playerName, settingsStore.botCount);
    gameStore.initializeGame(
      roomStore.room.players.map(({ id, name, seat }) => ({ id, name, seat })),
      roomStore.currentPlayerId,
      {
        seed: `bots-${Date.now()}`,
        phaseId: 1,
        useDemoHand: false,
      },
    );
    if (gameStore.match) void roomStore.publishGameState(gameStore.match);
    return;
  }
  if (isGameMatch(gameState.value)) {
    gameStore.hydrateGame(gameState.value, currentPlayerId.value);
    return;
  }
  if (match.value) return;
  gameStore.initializeGame(
    room.value.players.map(({ id, name, seat }) => ({ id, name, seat })),
    currentPlayerId.value,
    { seed: `room-${room.value.code}`, phaseId: 1, useDemoHand: false },
  );
});

watch(gameState, (nextState) => {
  if (!isGameMatch(nextState) || nextState === match.value) return;
  gameStore.hydrateGame(nextState, currentPlayerId.value);
});

async function syncAction(action: () => void): Promise<void> {
  const previousMatch = match.value;
  action();
  if (match.value && match.value !== previousMatch) {
    await roomStore.publishGameState(match.value);
  }
}

function beginNextRound(): void {
  void syncAction(() =>
    gameStore.beginNextRound(`round-${Date.now().toString(36)}`),
  );
}

function draw(source: DrawSource): void {
  void syncAction(() => gameStore.draw(source));
}

function submitPhase(): void {
  void syncAction(() => gameStore.submitPhase());
}

function setWildValue(cardId: string, value: number): void {
  void syncAction(() => gameStore.setWildValue(cardId, value));
}

function hitSelectedCards(targetPlayerId: string, meldId: string): void {
  void syncAction(() => gameStore.hitSelectedCards(targetPlayerId, meldId));
}

function discardSelected(): void {
  void syncAction(() => gameStore.discardSelected());
}

function setOperation(operation: MathOperation): void {
  gameStore.setOperation(operation);
}

function isGameMatch(value: unknown): value is GameMatch {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GameMatch>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.round === 'number' &&
    Array.isArray(candidate.players) &&
    Array.isArray(candidate.deck) &&
    Array.isArray(candidate.discardPile) &&
    (candidate.status === 'playing' ||
      candidate.status === 'round-ended' ||
      candidate.status === 'match-ended') &&
    (candidate.turnStep === 'draw' || candidate.turnStep === 'build')
  );
}
</script>

<template>
  <IonPage>
    <IonContent
      :fullscreen="true"
      :scroll-y="true"
      class="screen-content--table"
    >
      <GameTable
        v-if="match?.status === 'playing'"
        :room="room"
        :match="match"
        :current-player-id="currentPlayerId"
        :thinking-player-id="thinkingBotId"
        :phase="currentPhase"
        :hand="currentHand"
        :selected-cards="selectedCards"
        :selected-ids="selectedCardIds"
        :staged-ids="stagedCardIds"
        :staged-melds="stagedMeldDetails"
        :selected-operation="selectedOperation"
        :feedback-message="
          thinkingBotName
            ? `${thinkingBotName} is thinking…`
            : settingsStore.showHints
              ? feedbackMessage
              : ''
        "
        :candidate-message="candidateValidation.message"
        :can-draw="canDraw"
        :can-select-cards="canSelectCards"
        :can-stage-meld="canStageMeld"
        :can-submit-phase="canSubmitPhase"
        :can-discard="canDiscard"
        :can-hit="canHit"
        :phase-complete="currentPlayer?.completedPhase ?? false"
        @toggle-card="gameStore.toggleCard"
        @draw="draw"
        @update-operation="setOperation"
        @stage-meld="gameStore.stageSelectedMeld"
        @unstage-meld="gameStore.removeStagedMeld"
        @submit-phase="submitPhase"
        @discard="discardSelected"
        @clear-selection="gameStore.clearSelection"
        @hit="hitSelectedCards"
        @set-wild-value="setWildValue"
      />
      <MatchResultPanel
        v-else-if="match"
        :round="match.round"
        :winner-name="winnerName"
        @next-round="beginNextRound"
        @home="router.replace('/')"
      />
      <div
        v-else
        class="game-loading"
      >
        <IonSpinner name="crescent" />
        <span>Syncing the table…</span>
      </div>
      <IonToast
        :is-open="Boolean(errorMessage)"
        :message="errorMessage"
        :duration="3500"
        color="danger"
        @did-dismiss="roomStore.clearError()"
      />
    </IonContent>
  </IonPage>
</template>

<style scoped>
.game-loading {
  display: grid;
  min-height: 100%;
  place-content: center;
  justify-items: center;
  gap: 0.75rem;
  color: #b9cadd;
  font-size: 0.75rem;
}

.game-loading ion-spinner {
  color: var(--color-turn);
}
</style>
