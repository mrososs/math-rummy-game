<script setup lang="ts">
import { shallowRef } from 'vue';
import { IonButton, IonInput } from '@ionic/vue';
import type { CreateRoomInput } from 'network-contracts';
import ScreenHeader from '../layout/ScreenHeader.vue';

const props = defineProps<{
  isSubmitting?: boolean;
  initialName?: string;
}>();

const emit = defineEmits<{
  back: [];
  submit: [input: CreateRoomInput];
}>();

const hostName = shallowRef((props.initialName ?? '').trim() || 'Player');
const maxPlayers = shallowRef(6);

function changePlayerCount(delta: number) {
  maxPlayers.value = Math.min(8, Math.max(2, maxPlayers.value + delta));
}

function submit() {
  emit('submit', {
    hostName: hostName.value,
    transport: 'wifi',
    maxPlayers: maxPlayers.value,
  });
}
</script>

<template>
  <div class="room-form">
    <ScreenHeader
      title="Create Room"
      @back="emit('back')"
    />
    <form
      class="room-form__body safe-area-block"
      @submit.prevent="submit"
    >
      <label class="field-group">
        <span class="field-label">Host name</span>
        <IonInput
          v-model="hostName"
          class="text-field"
          aria-label="Host name"
          :maxlength="20"
        />
      </label>

      <fieldset class="field-group">
        <legend class="field-label">
          Max players
        </legend>
        <div class="stepper">
          <button
            type="button"
            aria-label="Remove one player"
            @click="changePlayerCount(-1)"
          >
            −
          </button>
          <strong>{{ maxPlayers }}</strong>
          <button
            type="button"
            aria-label="Add one player"
            @click="changePlayerCount(1)"
          >
            +
          </button>
        </div>
      </fieldset>

      <p class="room-form__hint">
        A unique room code and QR appear in the lobby once you open it. Share
        either one so friends can join.
      </p>

      <IonButton
        class="primary-button room-form__submit"
        expand="block"
        type="submit"
        :disabled="props.isSubmitting"
      >
        {{ props.isSubmitting ? 'Opening Lobby…' : 'Open Lobby' }}
      </IonButton>
    </form>
  </div>
</template>

<style scoped>
.room-form {
  min-height: 100%;
  background: var(--color-surface-soft);
}

.room-form__body {
  display: grid;
  gap: 1.35rem;
}

.field-group {
  display: grid;
  gap: 0.48rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.field-label {
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.text-field {
  min-height: 3.25rem;
  border: 1px solid var(--color-card-border);
  border-radius: 0.85rem;
  background: var(--color-card);
  --highlight-color-focused: var(--color-action);
  --padding-start: 0.9rem;
  --padding-end: 0.9rem;
}

.stepper {
  display: grid;
  min-height: 3.25rem;
  grid-template-columns: 3rem 1fr 3rem;
  align-items: center;
  border: 1px solid var(--color-card-border);
  border-radius: 0.85rem;
  background: var(--color-card);
  text-align: center;
}

.stepper button {
  width: 2.5rem;
  height: 2.5rem;
  margin: auto;
  border: 0;
  border-radius: 0.62rem;
  background: var(--color-surface);
  color: var(--color-action);
  cursor: pointer;
  font-size: 1.3rem;
  font-weight: 700;
}

.stepper strong {
  font-family: var(--font-display);
  font-size: 1.25rem;
}

.room-form__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.78rem;
  line-height: 1.5;
}

.room-form__submit {
  margin-top: 0.3rem;
}
</style>
