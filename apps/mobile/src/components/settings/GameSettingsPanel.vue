<script setup lang="ts">
import { reactive } from 'vue';
import { IonButton, IonToggle } from '@ionic/vue';
import type {
  BotTurnSpeed,
  GameSettings,
} from '../../stores/use-settings-store';
import type { BotDifficulty } from 'game-domain';

const props = defineProps<{
  settings: GameSettings;
}>();

const emit = defineEmits<{
  save: [settings: GameSettings];
}>();

const draft = reactive<GameSettings>({ ...props.settings });

const difficultyOptions: readonly {
  value: BotDifficulty;
  label: string;
  description: string;
}[] = [
  { value: 'easy', label: 'Easy', description: 'Bots discard simply.' },
  {
    value: 'standard',
    label: 'Standard',
    description: 'Bots solve phases and shed costly cards.',
  },
  {
    value: 'clever',
    label: 'Clever',
    description: 'Bots protect useful combinations.',
  },
];

function updateNumber(event: Event): void {
  draft.botCount = Number((event.target as HTMLSelectElement).value);
}

function updateDifficulty(event: Event): void {
  draft.botDifficulty = (event.target as HTMLSelectElement)
    .value as BotDifficulty;
}

function updateSpeed(event: Event): void {
  draft.botTurnSpeed = (event.target as HTMLSelectElement)
    .value as BotTurnSpeed;
}
</script>

<template>
  <form
    class="settings-panel"
    @submit.prevent="emit('save', { ...draft })"
  >
    <section
      class="settings-section"
      aria-labelledby="profile-heading"
    >
      <div class="settings-section__heading">
        <span class="settings-section__number">01</span>
        <div>
          <h2 id="profile-heading">
            Your seat
          </h2>
          <p>This name appears at the table.</p>
        </div>
      </div>
      <label class="field">
        <span>Player name</span>
        <input
          v-model="draft.playerName"
          name="playerName"
          maxlength="24"
          autocomplete="nickname"
        >
      </label>
    </section>

    <section
      class="settings-section"
      aria-labelledby="bot-heading"
    >
      <div class="settings-section__heading">
        <span class="settings-section__number">02</span>
        <div>
          <h2 id="bot-heading">
            Practice table
          </h2>
          <p>Choose who sits down for offline matches.</p>
        </div>
      </div>
      <div class="field-grid">
        <label class="field">
          <span>Bot players</span>
          <select
            :value="draft.botCount"
            @change="updateNumber"
          >
            <option
              v-for="count in 5"
              :key="count"
              :value="count"
            >
              {{ count }} bot{{ count === 1 ? '' : 's' }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>Difficulty</span>
          <select
            :value="draft.botDifficulty"
            @change="updateDifficulty"
          >
            <option
              v-for="option in difficultyOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <small>{{
            difficultyOptions.find(
              (option) => option.value === draft.botDifficulty,
            )?.description
          }}</small>
        </label>
        <label class="field">
          <span>Turn pace</span>
          <select
            :value="draft.botTurnSpeed"
            @change="updateSpeed"
          >
            <option value="quick">Quick · 2 seconds</option>
            <option value="relaxed">Relaxed · 3.5 seconds</option>
          </select>
        </label>
      </div>
    </section>

    <section
      class="settings-section"
      aria-labelledby="access-heading"
    >
      <div class="settings-section__heading">
        <span class="settings-section__number">03</span>
        <div>
          <h2 id="access-heading">
            Table comfort
          </h2>
          <p>Keep the table clear and comfortable to follow.</p>
        </div>
      </div>
      <div class="toggle-row">
        <div>
          <strong>Turn hints</strong>
          <span>Show a short prompt below the table.</span>
        </div>
        <IonToggle
          v-model="draft.showHints"
          aria-label="Show turn hints"
        />
      </div>
      <div class="toggle-row">
        <div>
          <strong>Reduce motion</strong>
          <span>Use immediate transitions and shorter bot pauses.</span>
        </div>
        <IonToggle
          v-model="draft.reducedMotion"
          aria-label="Reduce motion"
        />
      </div>
    </section>

    <IonButton
      class="primary-button save-button"
      expand="block"
      type="submit"
    >
      Save settings
    </IonButton>
  </form>
</template>

<style scoped>
.settings-panel {
  display: grid;
  gap: 2rem;
  padding: 1.5rem max(1rem, env(safe-area-inset-right))
    max(2rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
}

.settings-section {
  display: grid;
  gap: 1rem;
}

.settings-section + .settings-section {
  padding-top: 2rem;
  border-top: 1px solid #cbd7e2;
}

.settings-section__heading {
  display: grid;
  grid-template-columns: 2.5rem 1fr;
  gap: 0.75rem;
  align-items: start;
}

.settings-section__number {
  color: var(--color-action);
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.settings-section__heading h2,
.settings-section__heading p {
  margin: 0;
}

.settings-section__heading h2 {
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 1.25rem;
}

.settings-section__heading p {
  margin-top: 0.25rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.field-grid,
.field {
  display: grid;
  gap: 0.45rem;
}

.field-grid {
  gap: 1rem;
}

.field > span {
  color: #334658;
  font-size: 0.82rem;
  font-weight: 750;
}

.field input,
.field select {
  min-height: 3rem;
  width: 100%;
  padding: 0 0.85rem;
  border: 1px solid #aebdcc;
  border-radius: 0.65rem;
  background: var(--color-card);
  color: var(--color-ink);
}

.field input:focus-visible,
.field select:focus-visible {
  outline: 3px solid color-mix(in oklch, var(--color-action) 45%, transparent);
  outline-offset: 2px;
}

.field small {
  color: var(--color-text-muted);
  line-height: 1.45;
}

.toggle-row {
  display: grid;
  min-height: 4rem;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 1rem;
  border-bottom: 1px solid #d6dfe7;
}

.toggle-row div {
  display: grid;
  gap: 0.2rem;
}

.toggle-row strong {
  color: var(--color-ink);
  font-size: 0.9rem;
}

.toggle-row span {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  line-height: 1.4;
}

.save-button {
  margin: 0;
}

@media (min-width: 42rem) {
  .field-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
