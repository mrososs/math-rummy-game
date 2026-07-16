<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { IonButton, IonIcon, IonInput } from '@ionic/vue';
import { qrCodeOutline } from 'ionicons/icons';
import { normalizeRoomCode } from 'network-contracts';
import ScreenHeader from '../layout/ScreenHeader.vue';
import QrScannerModal from './QrScannerModal.vue';

const props = defineProps<{
  isSubmitting?: boolean;
  initialName?: string;
}>();

const emit = defineEmits<{
  back: [];
  submit: [roomCode: string, playerName: string];
}>();

const playerName = shallowRef((props.initialName ?? '').trim() || 'Player');
const rawCode = shallowRef('');
const roomCode = computed(() => normalizeRoomCode(rawCode.value));
const scannerOpen = ref(false);

function submit() {
  emit('submit', roomCode.value, playerName.value);
}

function onScanned(code: string) {
  rawCode.value = code;
  scannerOpen.value = false;
  // The scanned code is complete, so join straight away.
  emit('submit', normalizeRoomCode(code), playerName.value);
}
</script>

<template>
  <div class="join-room">
    <ScreenHeader
      title="Join Room"
      @back="emit('back')"
    />
    <form
      class="join-room__body safe-area-block"
      @submit.prevent="submit"
    >
      <label class="join-field">
        <span class="join-label">Your name</span>
        <IonInput
          v-model="playerName"
          class="join-input"
          aria-label="Your name"
          :maxlength="20"
        />
      </label>

      <label class="join-field">
        <span class="join-label">Enter code</span>
        <IonInput
          v-model="rawCode"
          class="code-input"
          aria-label="Four-character room code"
          inputmode="text"
          autocapitalize="characters"
          :maxlength="4"
          placeholder="––––"
        />
      </label>

      <IonButton
        class="scan-button"
        expand="block"
        fill="outline"
        type="button"
        @click="scannerOpen = true"
      >
        <IonIcon
          slot="start"
          :icon="qrCodeOutline"
        />
        Scan QR code
      </IonButton>

      <IonButton
        class="primary-button"
        expand="block"
        type="submit"
        :disabled="roomCode.length !== 4 || props.isSubmitting"
      >
        {{ props.isSubmitting ? 'Joining…' : 'Join Room' }}
      </IonButton>
    </form>

    <QrScannerModal
      :is-open="scannerOpen"
      @scanned="onScanned"
      @close="scannerOpen = false"
    />
  </div>
</template>

<style scoped>
.join-room {
  min-height: 100%;
  background: var(--color-surface-soft);
}

.join-room__body {
  display: grid;
  gap: 1rem;
}

.join-field {
  display: grid;
  gap: 0.45rem;
}

.join-label {
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.join-input,
.code-input {
  border: 1px solid var(--color-card-border);
  border-radius: 0.85rem;
  background: var(--color-card);
  --padding-start: 0.9rem;
  --padding-end: 0.9rem;
}

.join-input {
  min-height: 3.1rem;
}

.code-input {
  min-height: 4.2rem;
  color: var(--color-navy);
  font-family: var(--font-display);
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: 0.7em;
  text-align: center;
}

.scan-button {
  min-height: 3.25rem;
  --border-color: var(--color-action);
  --border-radius: 0.85rem;
  --color: var(--color-action);
}
</style>
