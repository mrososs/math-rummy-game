<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { IonButton, IonInput, IonSegment, IonSegmentButton } from '@ionic/vue';
import { useRoomQr } from 'room-state';
import type { CreateRoomInput, TransportKind } from 'network-contracts';
import ScreenHeader from '../layout/ScreenHeader.vue';

const emit = defineEmits<{
  back: [];
  submit: [input: CreateRoomInput];
}>();

const props = defineProps<{
  isSubmitting?: boolean;
}>();

const hostName = shallowRef('Maya');
const transport = shallowRef<TransportKind>('auto');
const maxPlayers = shallowRef(6);
const roomCode = computed(() => 'K4P9');
const { dataUrl: qrDataUrl } = useRoomQr(roomCode);

function changePlayerCount(delta: number) {
  maxPlayers.value = Math.min(8, Math.max(2, maxPlayers.value + delta));
}

function submit() {
  emit('submit', {
    hostName: hostName.value,
    transport: transport.value,
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
          Transport
        </legend>
        <IonSegment
          v-model="transport"
          class="transport-segment"
          aria-label="Local connection transport"
        >
          <IonSegmentButton value="auto">
            Auto
          </IonSegmentButton>
          <IonSegmentButton value="wifi">
            Wi-Fi
          </IonSegmentButton>
          <IonSegmentButton value="bluetooth">
            Bluetooth
          </IonSegmentButton>
        </IonSegment>
      </fieldset>

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

      <section
        class="room-code"
        aria-labelledby="room-code-title"
      >
        <img
          v-if="qrDataUrl"
          class="room-code__qr"
          :src="qrDataUrl"
          alt="QR code for room K4P9"
        >
        <div>
          <span
            id="room-code-title"
            class="field-label"
          >Room code</span>
          <strong class="room-code__value">{{ roomCode }}</strong>
          <small>Scan QR or enter code</small>
        </div>
      </section>

      <IonButton
        class="primary-button room-form__submit"
        expand="block"
        type="submit"
        :disabled="props.isSubmitting"
      >
        {{ props.isSubmitting ? 'Opening Lobbyâ€¦' : 'Open Lobby' }}
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

.transport-segment {
  min-height: 3rem;
  padding: 0.22rem;
  border-radius: 0.82rem;
  background: var(--color-surface);
  --background: var(--color-surface);
}

.transport-segment ion-segment-button {
  min-width: 0;
  min-height: 2.55rem;
  --border-radius: 0.68rem;
  --color: var(--color-text-muted);
  --color-checked: #f8fafc;
  --indicator-color: var(--color-action);
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

.room-code {
  display: grid;
  grid-template-columns: 4.5rem 1fr;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border-radius: 1rem;
  background: var(--color-surface);
}

.room-code__qr {
  width: 4.5rem;
  aspect-ratio: 1;
  border-radius: 0.6rem;
  background: var(--color-card);
}

.room-code__value {
  display: block;
  margin: 0.15rem 0;
  color: var(--color-navy);
  font-family: var(--font-display);
  font-size: 2rem;
  letter-spacing: 0.12em;
}

.room-code small {
  color: var(--color-text-muted);
}

.room-form__submit {
  margin-top: 0.3rem;
}
</style>
