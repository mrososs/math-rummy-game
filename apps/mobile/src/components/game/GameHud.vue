<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { cloudDoneOutline, hourglassOutline, podiumOutline } from 'ionicons/icons';
import type { PhaseDefinition, TurnStep } from 'game-domain';

const props = defineProps<{
  phase: PhaseDefinition;
  round: number;
  activePlayerName: string;
  isYourTurn: boolean;
  turnStep: TurnStep;
}>();

const emit = defineEmits<{
  openScores: [];
}>();

const turnLabel = computed(() => {
  if (!props.isYourTurn) return `${props.activePlayerName}'s turn`;
  return props.turnStep === 'draw'
    ? 'Your turn · draw'
    : 'Your turn · build or discard';
});
</script>

<template>
  <header class="game-hud safe-area-block">
    <div class="game-hud__phase">
      <span>Round {{ props.round }} · Phase {{ props.phase.id }} of 10</span>
      <strong>{{ props.phase.shortTitle }}</strong>
    </div>

    <div class="game-hud__right">
      <div
        class="game-hud__turn"
        :class="{ 'game-hud__turn--active': props.isYourTurn }"
        aria-live="polite"
      >
        <IonIcon :icon="props.isYourTurn ? hourglassOutline : cloudDoneOutline" />
        <span>{{ turnLabel }}</span>
      </div>
      <button
        type="button"
        class="game-hud__scores"
        aria-label="Show scoreboard"
        @click="emit('openScores')"
      >
        <IonIcon :icon="podiumOutline" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.game-hud {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.65rem;
}

.game-hud__phase {
  display: grid;
  min-width: 0;
  gap: 0.16rem;
}

.game-hud__phase span {
  color: var(--color-turn);
  font-family: var(--font-display);
  font-size: 0.64rem;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.game-hud__phase strong {
  overflow: hidden;
  color: #f2f7fb;
  font-family: var(--font-display);
  font-size: clamp(0.88rem, 3.5vw, 1rem);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-hud__right {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex: 0 1 auto;
  min-width: 0;
}

.game-hud__turn {
  display: inline-flex;
  min-height: 2rem;
  min-width: 0;
  align-items: center;
  gap: 0.35rem;
  flex: 0 1 auto;
  padding: 0.35rem 0.65rem;
  border: 1px solid #315779;
  border-radius: 999px;
  color: #b9cadd;
  font-size: 0.67rem;
  font-weight: 750;
}

.game-hud__turn span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-hud__scores {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  width: 2.1rem;
  height: 2.1rem;
  padding: 0;
  border: 1px solid #315779;
  border-radius: 999px;
  background: color-mix(in oklch, var(--color-turn) 10%, transparent);
  color: var(--color-turn);
  cursor: pointer;
  font-size: 1.05rem;
}

.game-hud__scores:active {
  background: color-mix(in oklch, var(--color-turn) 22%, transparent);
}

.game-hud__scores:focus-visible {
  outline: 2px solid var(--color-turn);
  outline-offset: 2px;
}

.game-hud__turn--active {
  border-color: color-mix(in oklch, var(--color-turn) 60%, #315779);
  background: color-mix(in oklch, var(--color-turn) 13%, transparent);
  color: var(--color-turn);
}
</style>
