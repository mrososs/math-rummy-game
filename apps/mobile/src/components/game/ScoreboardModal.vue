<script setup lang="ts">
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
} from '@ionic/vue';
import { closeOutline, trophy } from 'ionicons/icons';
import type { ScoreEntry } from './scoreboard';

const props = defineProps<{
  isOpen: boolean;
  entries: readonly ScoreEntry[];
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <IonModal
    :is-open="props.isOpen"
    @did-dismiss="emit('close')"
  >
    <IonHeader>
      <IonToolbar>
        <IonTitle>Scoreboard</IonTitle>
        <IonButtons slot="end">
          <IonButton
            aria-label="Close scoreboard"
            @click="emit('close')"
          >
            <IonIcon
              slot="icon-only"
              :icon="closeOutline"
            />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent class="scoreboard-content">
      <ol class="scoreboard">
        <li
          v-for="(entry, index) in props.entries"
          :key="entry.id"
          class="scoreboard__row"
          :class="{ 'scoreboard__row--you': entry.isYou }"
        >
          <span class="scoreboard__rank">{{ index + 1 }}</span>
          <span
            class="scoreboard__dot"
            :style="{ background: entry.color }"
            aria-hidden="true"
          />
          <span class="scoreboard__name">
            <span class="scoreboard__name-text">{{ entry.name }}</span>
            <IonIcon
              v-if="entry.isWinner"
              class="scoreboard__trophy"
              :icon="trophy"
              aria-label="Winner"
            />
            <small v-if="entry.isYou">You</small>
            <small v-else-if="entry.isHost">Host</small>
          </span>
          <span class="scoreboard__meta">
            <strong>{{ entry.score }}<small> pts</small></strong>
            <small class="scoreboard__phase">Phase {{ entry.phaseId }}/10 · {{ entry.phaseTitle }}</small>
            <small>{{ entry.cardsRemaining }} cards left</small>
            <small
              v-if="entry.gamesPlayed !== undefined"
              class="scoreboard__record"
            >{{ entry.gamesWon ?? 0 }} won / {{ entry.gamesPlayed }} played</small>
          </span>
        </li>
      </ol>
      <p class="scoreboard__hint">
        Furthest phase leads · fewer points is better.
      </p>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.scoreboard-content {
  --background: var(--color-surface, #eef3f8);
  --color: var(--color-navy, #0b2545);
}

.scoreboard {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0.9rem;
  list-style: none;
}

.scoreboard__row {
  display: grid;
  grid-template-columns: 1.5rem 0.7rem 1fr auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid #d3dde7;
  border-radius: 0.85rem;
  background: #f8fafc;
  color: var(--color-navy, #0b2545);
}

.scoreboard__row--you {
  border-color: color-mix(in oklch, var(--color-turn, #f59e0b) 60%, #d3dde7);
  background: color-mix(in oklch, var(--color-turn, #f59e0b) 12%, #f8fafc);
}

.scoreboard__rank {
  font-family: var(--font-display, sans-serif);
  font-size: 0.95rem;
  font-weight: 800;
  text-align: center;
  color: var(--color-text-muted, #5b6b7b);
}

.scoreboard__dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
}

.scoreboard__name {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  font-weight: 750;
}

.scoreboard__name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scoreboard__name small {
  flex: 0 0 auto;
  padding: 0.08rem 0.4rem;
  border-radius: 999px;
  background: #d4e0eb;
  color: var(--color-text-muted, #5b6b7b);
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.scoreboard__trophy {
  flex: 0 0 auto;
  color: var(--color-turn, #f59e0b);
  font-size: 1rem;
}

.scoreboard__meta {
  display: grid;
  justify-items: end;
  gap: 0.1rem;
  max-width: 11rem;
  text-align: right;
}

.scoreboard__phase {
  color: var(--color-navy, #0b2545) !important;
  font-weight: 700;
}

.scoreboard__meta strong {
  font-family: var(--font-display, sans-serif);
  font-size: 1.05rem;
}

.scoreboard__meta strong small {
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--color-text-muted, #5b6b7b);
}

.scoreboard__meta > small {
  color: var(--color-text-muted, #5b6b7b);
  font-size: 0.62rem;
}

.scoreboard__record {
  color: var(--color-action, #2e74b5) !important;
  font-weight: 700;
}

.scoreboard__hint {
  margin: 0 0.9rem;
  color: var(--color-text-muted, #5b6b7b);
  font-size: 0.66rem;
  text-align: center;
}
</style>
