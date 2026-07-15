<script setup lang="ts">
import { computed } from 'vue';
import type { GameCard, LaidMeld } from 'game-domain';
import type { RoomSnapshot } from 'network-contracts';
import { PlayerBadge, PlayingCard } from 'shared-ui';
import TableMeldLane from './TableMeldLane.vue';

const props = defineProps<{
  room: RoomSnapshot;
  currentPlayerId: string;
  activePlayerId: string;
  thinkingPlayerId?: string;
  discardTop?: GameCard;
  deckCount: number;
  canDraw: boolean;
  canHit: boolean;
  laidMelds: readonly LaidMeld[];
  cardCounts: Readonly<Record<string, number>>;
}>();

const emit = defineEmits<{
  draw: [source: 'deck' | 'discard'];
  hit: [targetPlayerId: string, meldId: string];
}>();

const opponents = computed(() =>
  props.room.players
    .filter((player) => player.id !== props.currentPlayerId)
    .slice(0, 7)
    .map((player) => ({
      ...player,
      cardsRemaining: props.cardCounts[player.id] ?? player.cardsRemaining,
    })),
);
const currentPlayer = computed(() =>
  props.room.players.find((player) => player.id === props.currentPlayerId),
);
const playerNames = computed(() =>
  Object.fromEntries(props.room.players.map((player) => [player.id, player.name])),
);
const drawPileCard: GameCard = { id: 'draw-pile', kind: 'wild' };

function handleHit(targetPlayerId: string, meldId: string): void {
  emit('hit', targetPlayerId, meldId);
}
</script>

<template>
  <section class="board-shell">
    <div
      class="opponent-rail"
      aria-label="Other players"
    >
      <PlayerBadge
        v-for="player in opponents"
        :key="player.id"
        :player="player"
        :active="player.id === props.activePlayerId"
        :thinking="player.id === props.thinkingPlayerId"
        :compact="true"
      />
    </div>

    <main
      class="felt-table"
      aria-label="Shared game table"
    >
      <div class="felt-table__grain" />
      <div class="felt-table__piles">
        <button
          class="pile"
          type="button"
          :disabled="!props.canDraw"
          aria-label="Draw from deck"
          @click="emit('draw', 'deck')"
        >
          <span
            class="pile__stack"
            aria-hidden="true"
          />
          <PlayingCard
            :card="drawPileCard"
            :face-down="true"
            :compact="true"
            :interactive="false"
          />
          <strong>Deck</strong>
          <small>{{ props.deckCount }} cards</small>
        </button>

        <button
          class="pile pile--discard"
          type="button"
          :disabled="!props.canDraw || !props.discardTop"
          aria-label="Pick up the discard"
          @click="emit('draw', 'discard')"
        >
          <PlayingCard
            v-if="props.discardTop"
            :card="props.discardTop"
            :compact="true"
            :interactive="false"
          />
          <span
            v-else
            class="pile__empty"
            aria-hidden="true"
          />
          <strong>Discard</strong>
          <small>Pick up top</small>
        </button>
      </div>

      <TableMeldLane
        v-if="props.laidMelds.length"
        :melds="props.laidMelds"
        :player-names="playerNames"
        :can-hit="props.canHit"
        @hit="handleHit"
      />

      <span
        v-else
        class="felt-table__hint"
      >Completed phases land here</span>
    </main>

    <PlayerBadge
      v-if="currentPlayer"
      :player="{
        ...currentPlayer,
        cardsRemaining:
          props.cardCounts[currentPlayer.id] ?? currentPlayer.cardsRemaining,
      }"
      :active="currentPlayer.id === props.activePlayerId"
      :thinking="currentPlayer.id === props.thinkingPlayerId"
      class="current-player"
    />
  </section>
</template>

<style scoped>
.board-shell {
  display: grid;
  min-width: 0;
  justify-items: center;
  gap: 0.45rem;
}

.opponent-rail {
  display: flex;
  width: 100%;
  min-width: 0;
  justify-content: safe center;
  gap: 0.85rem;
  overflow-x: auto;
  padding: 0.2rem 0.9rem 0.45rem;
  scrollbar-width: none;
}

.felt-table {
  position: relative;
  display: grid;
  width: min(96vw, 38rem);
  box-sizing: border-box;
  min-height: 20rem;
  align-content: space-between;
  gap: 1rem;
  overflow: hidden;
  padding: 1.1rem 0.8rem 0.8rem;
  border: 0.28rem solid #081d33;
  border-radius: 1.25rem;
  background: #194b78;
  box-shadow:
    inset 0 0 0 0.12rem #326d9f,
    inset 0 0 2.5rem rgb(3 19 34 / 58%),
    0 1rem 2rem -1.2rem rgb(0 0 0 / 70%);
}

.felt-table__piles :deep(.playing-card) {
  width: 3.65rem;
}

.felt-table__grain {
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    18deg,
    rgb(255 255 255 / 2%) 0 1px,
    transparent 1px 4px
  );
  pointer-events: none;
}

.felt-table__piles {
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 1.25rem;
  padding: 0.3rem 0 0.7rem;
}

.pile {
  position: relative;
  display: grid;
  min-width: 4.8rem;
  justify-items: center;
  gap: 0.1rem;
  padding: 0.2rem;
  border: 0;
  background: transparent;
  color: #e7eff7;
  cursor: pointer;
}

.pile:disabled {
  cursor: default;
  opacity: 0.68;
}

.pile:focus-visible {
  border-radius: 0.65rem;
  outline: 3px solid var(--color-turn);
  outline-offset: 0.2rem;
}

.pile strong {
  margin-top: 0.28rem;
  font-family: var(--font-display);
  font-size: 0.7rem;
}

.pile small {
  color: #9fb8cf;
  font-size: 0.55rem;
}

.pile__stack {
  position: absolute;
  top: 0.08rem;
  width: 3.1rem;
  aspect-ratio: 0.7;
  border: 1px solid #47749d;
  border-radius: 0.5rem;
  transform: translate(0.22rem, -0.14rem) rotate(3deg);
}

.pile--discard :deep(.playing-card) {
  border-color: var(--color-turn);
  transform: rotate(2deg);
}

.pile__empty {
  width: 3.1rem;
  aspect-ratio: 0.7;
  border: 1px dashed #7394b2;
  border-radius: 0.5rem;
}

.felt-table__hint {
  position: relative;
  z-index: 1;
  display: grid;
  min-height: 5rem;
  place-items: center;
  border-top: 1px solid #4b7aa4;
  color: #8eabc4;
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-align: center;
  text-transform: uppercase;
}

.current-player {
  width: max-content;
  max-width: 88vw;
}

@media (orientation: landscape) and (min-width: 40rem) {
  .board-shell {
    grid-template-columns: 9rem minmax(28rem, 1fr);
    grid-template-rows: minmax(14rem, 1fr) auto;
  }

  .opponent-rail {
    width: auto;
    max-height: 19rem;
    align-content: center;
    align-self: stretch;
    flex-direction: column;
    justify-content: center;
  }

  .felt-table {
    width: min(68vw, 48rem);
    min-height: 21rem;
  }

  .current-player {
    grid-column: 2;
  }
}
</style>
