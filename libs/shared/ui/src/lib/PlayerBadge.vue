<script setup lang="ts">
import { computed } from 'vue';
import type { RoomPlayer } from 'network-contracts';

const props = withDefaults(
  defineProps<{
    player: RoomPlayer;
    active?: boolean;
    thinking?: boolean;
    compact?: boolean;
    showConnection?: boolean;
  }>(),
  { active: false, thinking: false, compact: false, showConnection: false },
);

const connectionLabel = computed(
  () => `${props.player.transport} · ${props.player.connection}`,
);
</script>

<template>
  <div
    class="player-badge"
    :class="{
      'player-badge--active': props.active,
      'player-badge--compact': props.compact,
    }"
  >
    <span
      class="player-badge__avatar"
      :style="{ backgroundColor: props.player.color }"
    >P{{ props.player.seat }}</span>
    <span class="player-badge__identity">
      <strong class="player-badge__name">{{ props.player.name
      }}<span v-if="props.player.isHost"> · Host</span></strong>
      <small
        v-if="props.thinking"
        class="player-badge__thinking"
      >Thinking<span aria-hidden="true">...</span></small>
      <small
        v-else-if="props.showConnection"
        class="player-badge__connection"
      >{{
        connectionLabel
      }}</small>
    </span>
    <span
      class="player-badge__count"
      :aria-label="`${props.player.cardsRemaining} cards in hand`"
    >{{ props.player.cardsRemaining }}<small> cards</small></span>
  </div>
</template>

<style scoped>
.player-badge {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.55rem;
  color: inherit;
}

.player-badge--active {
  border-radius: 999px;
  background: var(--color-turn, #f59e0b);
  color: var(--color-navy, #0b2545);
  padding: 0.22rem 0.55rem 0.22rem 0.24rem;
}

.player-badge__avatar {
  display: grid;
  flex: 0 0 auto;
  width: 2rem;
  aspect-ratio: 1;
  place-items: center;
  border: 2px solid rgb(255 255 255 / 78%);
  border-radius: 50%;
  color: #f8fafc;
  font-family: var(--font-display, sans-serif);
  font-size: 0.62rem;
  font-weight: 700;
}

.player-badge--compact .player-badge__avatar {
  width: 1.55rem;
  font-size: 0.5rem;
}

.player-badge__identity {
  display: grid;
  min-width: 0;
}

.player-badge__name {
  overflow: hidden;
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-badge__connection {
  color: var(--color-success, #2e7d32);
  font-size: 0.68rem;
  text-transform: capitalize;
}

.player-badge__thinking {
  color: currentcolor;
  font-size: 0.62rem;
  font-weight: 750;
  opacity: 0.78;
}

.player-badge__count {
  margin-left: auto;
  padding: 0.16rem 0.38rem;
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: 999px;
  background: rgb(4 24 43 / 28%);
  color: var(--color-text-muted, #8ea4b9);
  font-size: 0.68rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.player-badge__count small {
  font-size: 0.52rem;
  font-weight: 650;
}

.player-badge--active .player-badge__count {
  border-color: rgb(11 37 69 / 18%);
  background: rgb(255 255 255 / 42%);
  color: var(--color-navy, #0b2545);
}

.player-badge--compact .player-badge__count {
  padding-inline: 0.3rem;
  font-size: 0.6rem;
}

.player-badge--compact .player-badge__count small {
  display: none;
}
</style>
