<script setup lang="ts">
import { IonButton } from '@ionic/vue';
import { PHASES, operationSymbol } from 'game-domain';

const emit = defineEmits<{
  practice: [];
}>();

const turnSteps = [
  {
    number: '1',
    title: 'Draw one card',
    copy: 'Take the top card from the deck or the discard pile.',
  },
  {
    number: '2',
    title: 'Build your phase',
    copy: 'Select cards, choose the operation, and stage every required group.',
  },
  {
    number: '3',
    title: 'Discard to finish',
    copy: 'End your turn by placing one unstaged card on the discard pile.',
  },
] as const;
</script>

<template>
  <article class="game-guide">
    <section
      class="guide-intro"
      aria-labelledby="guide-intro-title"
    >
      <p class="eyebrow">
        The goal
      </p>
      <h2 id="guide-intro-title">
        Complete all ten math phases first.
      </h2>
      <p>
        Each round asks for a new card pattern. Complete the phase, empty your
        hand, and move forward. Unfinished players repeat their phase next
        round.
      </p>
      <IonButton
        class="primary-button practice-button"
        @click="emit('practice')"
      >
        Practice with bots
      </IonButton>
    </section>

    <section
      class="turn-guide"
      aria-labelledby="turn-title"
    >
      <p class="eyebrow">
        Every turn
      </p>
      <h2 id="turn-title">
        Draw · build · discard
      </h2>
      <ol>
        <li
          v-for="step in turnSteps"
          :key="step.number"
        >
          <span aria-hidden="true">{{ step.number }}</span>
          <div>
            <strong>{{ step.title }}</strong>
            <p>{{ step.copy }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section
      class="phase-guide"
      aria-labelledby="phase-title"
    >
      <p class="eyebrow">
        The phase ladder
      </p>
      <h2 id="phase-title">
        Ten rounds of new ideas
      </h2>
      <div class="phase-list">
        <details
          v-for="phase in PHASES"
          :key="phase.id"
        >
          <summary>
            <span>{{ String(phase.id).padStart(2, '0') }}</span>
            <strong>{{ phase.shortTitle }}</strong>
          </summary>
          <div class="phase-detail">
            <p>{{ phase.title }}</p>
            <p>
              <strong>Example:</strong>
              {{ phase.example.join(' · ') }}
              <template v-if="phase.requirements[0]">
                {{
                  'operations' in phase.requirements[0]
                    ? operationSymbol(phase.requirements[0].operations[0])
                    : ''
                }}
              </template>
            </p>
            <p><strong>After laying:</strong> {{ phase.hitRule }}</p>
          </div>
        </details>
      </div>
    </section>

    <aside class="wild-note">
      <span aria-hidden="true">★</span>
      <div>
        <h2>Wild cards</h2>
        <p>
          A wild may stand for any number from 1 to 12. Choose its value before
          staging the group. Wilds left in your hand cost 25 points.
        </p>
      </div>
    </aside>
  </article>
</template>

<style scoped>
.game-guide {
  display: grid;
  gap: 3rem;
  padding: 2rem max(1rem, env(safe-area-inset-right))
    max(2.5rem, env(safe-area-inset-bottom))
    max(1rem, env(safe-area-inset-left));
}

.guide-intro,
.turn-guide,
.phase-guide {
  display: grid;
  gap: 0.75rem;
}

.game-guide h2,
.game-guide p {
  margin: 0;
}

.game-guide h2 {
  max-width: 18ch;
  font-family: var(--font-display);
  font-size: 1.55rem;
  letter-spacing: -0.025em;
  line-height: 1.15;
}

.guide-intro > p:not(.eyebrow),
.phase-detail p,
.wild-note p {
  color: var(--color-text-muted);
  line-height: 1.6;
}

.practice-button {
  width: min(100%, 20rem);
  margin: 0.75rem 0 0;
}

.turn-guide ol {
  display: grid;
  gap: 0;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
}

.turn-guide li {
  display: grid;
  grid-template-columns: 2.5rem 1fr;
  gap: 0.75rem;
  padding: 1rem 0;
  border-top: 1px solid #c8d4df;
}

.turn-guide li > span {
  display: grid;
  width: 1.8rem;
  height: 1.8rem;
  place-items: center;
  border-radius: 50%;
  background: var(--color-navy);
  color: #f4f8fb;
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 800;
}

.turn-guide li div {
  display: grid;
  gap: 0.2rem;
}

.turn-guide li p {
  color: var(--color-text-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.phase-list {
  margin-top: 0.5rem;
  border-top: 1px solid #b9c8d6;
}

.phase-list details {
  border-bottom: 1px solid #b9c8d6;
}

.phase-list summary {
  display: grid;
  min-height: 3.5rem;
  grid-template-columns: 2.5rem 1fr;
  align-items: center;
  cursor: pointer;
  list-style: none;
}

.phase-list summary::-webkit-details-marker {
  display: none;
}

.phase-list summary::after {
  content: '+';
  grid-row: 1;
  grid-column: 3;
  color: var(--color-action);
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 800;
}

.phase-list details[open] summary::after {
  content: '−';
}

.phase-list summary:focus-visible {
  outline: 3px solid color-mix(in oklch, var(--color-action) 45%, transparent);
  outline-offset: 2px;
}

.phase-list summary span {
  color: var(--color-action);
  font-family: var(--font-display);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
}

.phase-list summary strong {
  font-size: 0.92rem;
}

.phase-detail {
  display: grid;
  gap: 0.55rem;
  padding: 0 0 1rem 2.5rem;
}

.phase-detail p {
  font-size: 0.82rem;
}

.wild-note {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  padding: 1.2rem;
  background: #f6e2ae;
  color: #49330d;
}

.wild-note > span {
  color: #a96500;
  font-size: 1.5rem;
}

.wild-note h2 {
  font-size: 1.05rem;
}

.wild-note p {
  margin-top: 0.35rem;
  color: #654b1c;
  font-size: 0.85rem;
}

@media (min-width: 48rem) {
  .game-guide {
    grid-template-columns: 0.8fr 1.2fr;
  }

  .guide-intro,
  .turn-guide,
  .wild-note {
    align-self: start;
  }

  .phase-guide {
    grid-row: 1 / span 3;
    grid-column: 2;
  }
}
</style>
