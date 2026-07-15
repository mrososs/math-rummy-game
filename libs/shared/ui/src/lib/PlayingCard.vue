<script setup lang="ts">
import { computed } from 'vue';
import type { GameCard } from 'game-domain';

const props = withDefaults(
  defineProps<{
    card: GameCard;
    compact?: boolean;
    faceDown?: boolean;
    selected?: boolean;
    disabled?: boolean;
    interactive?: boolean;
    selectionIndex?: number;
    groupLabel?: string;
  }>(),
  {
    compact: false,
    faceDown: false,
    selected: false,
    disabled: false,
    interactive: true,
    selectionIndex: undefined,
    groupLabel: undefined,
  },
);

const emit = defineEmits<{
  select: [cardId: string];
}>();

const displayValue = computed(() => {
  if (props.card.kind === 'number') return props.card.value;
  return props.card.lockedValue ?? '★';
});

const ariaLabel = computed(() => {
  if (props.faceDown) return 'Face-down card';
  if (props.card.kind === 'wild') {
    return props.card.lockedValue
      ? `Wild card set to ${props.card.lockedValue}`
      : 'Wild card';
  }
  return `Number ${props.card.value}`;
});

function select(): void {
  if (props.interactive && !props.disabled) emit('select', props.card.id);
}
</script>

<template>
  <component
    :is="props.interactive ? 'button' : 'div'"
    class="playing-card"
    :class="{
      'playing-card--compact': props.compact,
      'playing-card--down': props.faceDown,
      'playing-card--selected': props.selected,
      'playing-card--wild': props.card.kind === 'wild' && !props.faceDown,
      'playing-card--disabled': props.disabled,
      'playing-card--staged': Boolean(props.groupLabel),
    }"
    :type="props.interactive ? 'button' : undefined"
    :aria-label="ariaLabel"
    :aria-pressed="props.interactive ? props.selected : undefined"
    :aria-disabled="props.disabled || undefined"
    :disabled="props.interactive ? props.disabled : undefined"
    @click="select"
  >
    <span
      v-if="props.selectionIndex"
      class="playing-card__selection"
      aria-hidden="true"
    >{{ props.selectionIndex }}</span>
    <span
      v-if="props.groupLabel"
      class="playing-card__group"
    >{{
      props.groupLabel
    }}</span>

    <template v-if="!props.faceDown">
      <span class="playing-card__corner">
        {{ props.card.kind === 'wild' ? 'W' : displayValue }}
      </span>
      <span class="playing-card__value">{{ displayValue }}</span>
      <span class="playing-card__mark">
        {{ props.card.kind === 'wild' ? 'WILD' : '◆' }}
      </span>
      <span class="playing-card__corner playing-card__corner--bottom">
        {{ props.card.kind === 'wild' ? 'W' : displayValue }}
      </span>
    </template>
    <span
      v-else
      class="playing-card__back-mark"
      aria-hidden="true"
    >± × ÷</span>
  </component>
</template>

<style scoped>
.playing-card {
  position: relative;
  display: grid;
  width: clamp(3.85rem, 17vw, 4.7rem);
  aspect-ratio: 0.7;
  place-items: center;
  flex: 0 0 auto;
  padding: 0;
  border: 1px solid var(--color-card-border, #d3dde7);
  border-radius: 0.7rem;
  background: var(--color-card, #fdfefe);
  box-shadow:
    0 0.18rem 0.18rem rgb(11 37 69 / 10%),
    0 0.75rem 1.15rem -0.8rem rgb(11 37 69 / 50%);
  color: var(--color-navy, #0b2545);
  cursor: pointer;
  font-family: var(--font-display, sans-serif);
  isolation: isolate;
  transition:
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 180ms ease,
    border-color 180ms ease,
    filter 180ms ease;
  touch-action: manipulation;
}

.playing-card::after {
  position: absolute;
  z-index: -1;
  inset: 0.28rem;
  border: 1px solid #e7eef5;
  border-radius: 0.48rem;
  content: '';
  pointer-events: none;
}

.playing-card--compact {
  width: 3.1rem;
  border-radius: 0.5rem;
}

.playing-card--selected {
  border-color: var(--color-turn, #f59e0b);
  box-shadow:
    0 0 0 0.18rem
      color-mix(in oklch, var(--color-turn, #f59e0b) 45%, transparent),
    0 1rem 1.5rem -0.85rem rgb(11 37 69 / 70%);
  transform: translateY(-0.65rem) rotate(-1deg);
}

.playing-card--staged {
  border-color: var(--color-success, #2e7d32);
  box-shadow: 0 0 0 0.12rem
    color-mix(in oklch, var(--color-success, #2e7d32) 35%, transparent);
}

.playing-card--disabled:not(.playing-card--staged) {
  cursor: default;
  filter: saturate(0.55) opacity(0.68);
}

.playing-card--wild {
  border: 2px solid var(--color-turn, #f59e0b);
  background-color: var(--color-navy, #0b2545);
  background-image: repeating-linear-gradient(
    135deg,
    rgb(255 255 255 / 4%) 0 8px,
    transparent 8px 16px
  );
  color: var(--color-turn, #f59e0b);
}

.playing-card--wild::after {
  border-color: color-mix(
    in oklch,
    var(--color-turn, #f59e0b) 50%,
    transparent
  );
}

.playing-card--down {
  border-color: #294c70;
  background-color: var(--color-navy, #0b2545);
  background-image:
    repeating-linear-gradient(
      45deg,
      rgb(255 255 255 / 5%) 0 6px,
      transparent 6px 12px
    ),
    repeating-linear-gradient(
      -45deg,
      rgb(255 255 255 / 5%) 0 6px,
      transparent 6px 12px
    );
  color: var(--color-turn, #f59e0b);
}

.playing-card__corner {
  position: absolute;
  top: 0.42rem;
  left: 0.48rem;
  z-index: 1;
  font-size: 0.78rem;
  font-weight: 800;
  line-height: 1;
}

.playing-card__corner--bottom {
  top: auto;
  right: 0.48rem;
  bottom: 0.42rem;
  left: auto;
  transform: rotate(180deg);
}

.playing-card__value {
  z-index: 1;
  font-size: clamp(1.9rem, 8vw, 2.35rem);
  font-weight: 750;
  letter-spacing: -0.06em;
}

.playing-card--compact .playing-card__value {
  font-size: 1.45rem;
}

.playing-card__mark {
  position: absolute;
  z-index: 1;
  bottom: 0.8rem;
  color: var(--color-action, #2e74b5);
  font-size: 0.45rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.playing-card--wild .playing-card__mark {
  color: var(--color-turn, #f59e0b);
}

.playing-card__back-mark {
  z-index: 1;
  display: grid;
  width: 2.35rem;
  aspect-ratio: 1;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 24%);
  border-radius: 50%;
  background: #123a63;
  font-size: 0.55rem;
  font-weight: 800;
}

.playing-card__selection,
.playing-card__group {
  position: absolute;
  z-index: 3;
  display: grid;
  min-width: 1.35rem;
  min-height: 1.35rem;
  place-items: center;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 800;
}

.playing-card__selection {
  top: -0.55rem;
  right: -0.4rem;
  background: var(--color-turn, #f59e0b);
  color: var(--color-navy, #0b2545);
}

.playing-card__group {
  right: 0.35rem;
  bottom: 0.35rem;
  padding: 0.1rem 0.35rem;
  background: var(--color-success, #2e7d32);
  color: #f7fbf8;
}

@media (hover: hover) {
  .playing-card:not(.playing-card--disabled):hover {
    transform: translateY(-0.3rem);
  }

  .playing-card--selected:not(.playing-card--disabled):hover {
    transform: translateY(-0.72rem) rotate(-1deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .playing-card {
    transition: none;
  }
}
</style>
