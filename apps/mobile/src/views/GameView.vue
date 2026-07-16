<script setup lang="ts">
import { computed } from 'vue';
import { IonContent, IonPage, IonSpinner, IonToast } from '@ionic/vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useGameStore } from 'game-state';
import { useRoomStore } from 'room-state';
import GameTable from '../components/game/GameTable.vue';
import MatchResultPanel from '../components/game/MatchResultPanel.vue';
import { useGameSession } from '../composables/useGameSession';
import { playSound } from '../composables/useSound';
import { useSettingsStore } from '../stores/use-settings-store';

const route = useRoute();
const router = useRouter();
const roomStore = useRoomStore();
const gameStore = useGameStore();
const settingsStore = useSettingsStore();
const isBotMode = computed(() => route.query.mode === 'bots');

// All game-session synchronization lives in the composable (F-06); this view
// only renders and forwards interaction.
const {
  busy,
  winnerName,
  thinkingBotId,
  thinkingBotName,
  draw,
  submitPhase,
  setOperation,
  setWildValue,
  hitSelectedCards,
  discardSelected,
  beginNextRound,
} = useGameSession(isBotMode);

const { errorMessage, room, currentPlayerId } = storeToRefs(roomStore);
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

function toggleCard(cardId: string): void {
  const wasSelected = gameStore.selectedCardIds.includes(cardId);
  gameStore.toggleCard(cardId);
  const nowSelected = gameStore.selectedCardIds.includes(cardId);
  if (nowSelected && !wasSelected) playSound('select');
  else if (!nowSelected && wasSelected) playSound('deselect');
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
        :can-draw="canDraw && !busy"
        :can-select-cards="canSelectCards"
        :can-stage-meld="canStageMeld"
        :can-submit-phase="canSubmitPhase && !busy"
        :can-discard="canDiscard && !busy"
        :can-hit="canHit && !busy"
        :phase-complete="currentPlayer?.completedPhase ?? false"
        @toggle-card="toggleCard"
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
