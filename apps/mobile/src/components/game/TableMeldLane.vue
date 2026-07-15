<script setup lang="ts">
import type { LaidMeld } from 'game-domain';
import { operationSymbol } from 'game-domain';
import { PlayingCard } from 'shared-ui';

const props = defineProps<{
  melds: readonly LaidMeld[];
  playerNames: Readonly<Record<string, string>>;
  canHit: boolean;
}>();

const emit = defineEmits<{
  hit: [targetPlayerId: string, meldId: string];
}>();

function ownerName(ownerId: string): string {
  return props.playerNames[ownerId] ?? 'Player';
}
</script>

<template>
  <section
    class="meld-lane"
    aria-labelledby="completed-phases-title"
  >
    <header class="meld-lane__header">
      <h2 id="completed-phases-title">
        Completed phases
      </h2>
      <span>{{ props.melds.length }} on table</span>
    </header>
    <div class="meld-lane__rail">
      <button
        v-for="meld in props.melds"
        :key="meld.id"
        class="meld-group"
        type="button"
        :disabled="!props.canHit"
        :aria-label="`Hit ${ownerName(meld.ownerId)}'s completed phase ${meld.phaseId}`"
        @click="emit('hit', meld.ownerId, meld.id)"
      >
        <span class="meld-group__meta">
          {{ ownerName(meld.ownerId) }} · Phase {{ meld.phaseId }}
        </span>
        <span class="meld-group__cards">
          <span class="meld-group__operation">{{
            operationSymbol(meld.operation)
          }}</span>
          <PlayingCard
            v-for="card in meld.cards"
            :key="card.id"
            :card="card"
            :compact="true"
            :interactive="false"
          />
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.meld-lane {
  position: relative;
  z-index: 2;
  display: grid;
  min-width: 0;
  width: 100%;
  gap: 0.55rem;
  padding-top: 0.75rem;
  border-top: 1px solid #4b7aa4;
}

.meld-lane__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 0.25rem;
}

.meld-lane__header h2,
.meld-lane__header span {
  margin: 0;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.meld-lane__header h2 {
  color: #eef5fb;
  font-family: var(--font-display);
  font-weight: 800;
}

.meld-lane__header span {
  color: #a9c2d8;
}

.meld-lane__rail {
  display: flex;
  min-width: 0;
  gap: 0.75rem;
  overflow-x: auto;
  padding: 0.2rem 0.25rem 0.6rem;
  overscroll-behavior-x: contain;
  scrollbar-color: #8baac5 transparent;
  touch-action: pan-x pan-y;
}

.meld-group {
  display: grid;
  flex: 0 0 auto;
  justify-items: start;
  gap: 0.35rem;
  padding: 0.55rem 0.65rem 0.65rem;
  border: 1px solid #4c7ca8;
  border-radius: 0.75rem;
  background: #113d65;
  color: #edf5fb;
}

.meld-group:disabled {
  opacity: 1;
}

.meld-group:not(:disabled) {
  cursor: pointer;
}

.meld-group:not(:disabled):focus-visible {
  outline: 3px solid var(--color-turn);
  outline-offset: 2px;
}

.meld-group__meta {
  color: #bed0e0;
  font-size: 0.58rem;
  font-weight: 750;
}

.meld-group__cards {
  display: flex;
  align-items: center;
  padding-right: 0.3rem;
}

.meld-group__cards :deep(.playing-card) {
  width: clamp(3rem, 14vw, 3.6rem);
  margin-left: -0.25rem;
}

.meld-group__operation {
  z-index: 2;
  display: grid;
  width: 1.8rem;
  aspect-ratio: 1;
  flex: 0 0 auto;
  place-items: center;
  margin-right: 0.35rem;
  border-radius: 50%;
  background: var(--color-turn);
  color: var(--color-navy);
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 850;
}
</style>
