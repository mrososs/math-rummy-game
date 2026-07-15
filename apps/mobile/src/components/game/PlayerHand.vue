<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue';
import type { GameCard } from 'game-domain';
import { cardValue } from 'game-domain';
import { PlayingCard } from 'shared-ui';

const props = defineProps<{
  cards: readonly GameCard[];
  selectedIds: readonly string[];
  stagedIds: readonly string[];
  selectable: boolean;
}>();

const emit = defineEmits<{
  toggleCard: [cardId: string];
}>();

type SortMode = 'number' | 'group';
const sortMode = shallowRef<SortMode>('number');
const cardRail = useTemplateRef<HTMLDivElement>('cardRail');
const selectedIdSet = computed(() => new Set(props.selectedIds));
const stagedIdSet = computed(() => new Set(props.stagedIds));
const displayedCards = computed(() => {
  const cards = [...props.cards];
  if (sortMode.value === 'group') {
    return cards.sort((first, second) => {
      const firstStaged = stagedIdSet.value.has(first.id) ? 0 : 1;
      const secondStaged = stagedIdSet.value.has(second.id) ? 0 : 1;
      return (
        firstStaged - secondStaged ||
        (cardValue(first) ?? 99) - (cardValue(second) ?? 99)
      );
    });
  }
  return cards.sort(
    (first, second) => (cardValue(first) ?? 99) - (cardValue(second) ?? 99),
  );
});

function selectionIndex(cardId: string): number | undefined {
  const index = props.selectedIds.indexOf(cardId);
  return index >= 0 ? index + 1 : undefined;
}

function groupLabel(cardId: string): string | undefined {
  const index = props.stagedIds.indexOf(cardId);
  return index >= 0 ? 'SET' : undefined;
}

function scrollCards(direction: -1 | 1): void {
  const rail = cardRail.value;
  if (!rail) return;
  rail.scrollBy({
    left: direction * Math.max(180, rail.clientWidth * 0.72),
    behavior: 'smooth',
  });
}
</script>

<template>
  <section
    class="player-hand"
    aria-labelledby="hand-title"
  >
    <header class="player-hand__header">
      <div>
        <span>PRIVATE HAND</span>
        <h2 id="hand-title">
          Your cards <strong>{{ props.cards.length }}</strong>
        </h2>
      </div>
      <div
        class="player-hand__sort"
        aria-label="Sort cards"
      >
        <button
          type="button"
          :class="{ 'player-hand__sort-active': sortMode === 'number' }"
          :aria-pressed="sortMode === 'number'"
          @click="sortMode = 'number'"
        >
          Number
        </button>
        <button
          type="button"
          :class="{ 'player-hand__sort-active': sortMode === 'group' }"
          :aria-pressed="sortMode === 'group'"
          @click="sortMode = 'group'"
        >
          Group
        </button>
      </div>
    </header>

    <div
      ref="cardRail"
      class="player-hand__cards"
      :class="{ 'player-hand__cards--locked': !props.selectable }"
      tabindex="0"
      aria-label="Scrollable card hand"
      @keydown.left.prevent="scrollCards(-1)"
      @keydown.right.prevent="scrollCards(1)"
    >
      <PlayingCard
        v-for="card in displayedCards"
        :key="card.id"
        :card="card"
        :selected="selectedIdSet.has(card.id)"
        :selection-index="selectionIndex(card.id)"
        :group-label="groupLabel(card.id)"
        :disabled="!props.selectable || stagedIdSet.has(card.id)"
        @select="emit('toggleCard', $event)"
      />
    </div>

    <p class="player-hand__hint">
      {{
        props.selectable
          ? 'Tap cards in equation order.'
          : 'Draw first to unlock your hand.'
      }}
    </p>
  </section>
</template>

<style scoped>
.player-hand {
  display: grid;
  gap: 0.7rem;
  padding: 0.8rem max(0.85rem, env(safe-area-inset-left)) 0.75rem;
  border-radius: 1.15rem 1.15rem 0 0;
  background: var(--color-surface);
  color: var(--color-navy);
}

.player-hand__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.player-hand__header > div:first-child {
  display: grid;
  gap: 0.08rem;
}

.player-hand__header span {
  color: var(--color-text-muted);
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.player-hand__header h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.98rem;
}

.player-hand__header h2 strong {
  display: inline-grid;
  min-width: 1.4rem;
  min-height: 1.4rem;
  place-items: center;
  margin-left: 0.25rem;
  border-radius: 50%;
  background: var(--color-turn);
  font-size: 0.68rem;
}

.player-hand__sort {
  display: flex;
  gap: 0.25rem;
  padding: 0.18rem;
  border-radius: 999px;
  background: #d4e0eb;
}

.player-hand__sort button {
  min-height: 2rem;
  padding: 0.2rem 0.65rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.62rem;
  font-weight: 750;
}

.player-hand__sort .player-hand__sort-active {
  background: #f8fafc;
  box-shadow: 0 0.12rem 0.35rem rgb(11 37 69 / 14%);
  color: var(--color-navy);
}

.player-hand__cards:focus-visible {
  outline: 3px solid color-mix(in oklch, var(--color-action) 45%, transparent);
  outline-offset: 2px;
}

.player-hand__cards {
  display: flex;
  align-items: flex-start;
  gap: 0.42rem;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.8rem 0.25rem 0.4rem;
  overscroll-behavior-x: contain;
  scroll-padding-inline: 0.25rem;
  scroll-snap-type: x proximity;
  scrollbar-color: #9fb3c6 transparent;
  touch-action: pan-x pan-y;
  -webkit-overflow-scrolling: touch;
}

.player-hand__cards :deep(.playing-card) {
  scroll-snap-align: center;
  touch-action: pan-x pan-y;
  user-select: none;
}

.player-hand__cards--locked {
  opacity: 0.78;
}

.player-hand__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.62rem;
  text-align: center;
}

@media (orientation: landscape) and (min-width: 40rem) {
  .player-hand {
    min-width: 0;
    border-radius: 0;
  }

  .player-hand__cards {
    justify-content: safe center;
  }
}

@media (pointer: coarse) {
  .player-hand__cards {
    scroll-snap-type: none;
  }
}
</style>
