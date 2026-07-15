<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { IonButton, IonIcon, IonInput } from '@ionic/vue';
import { qrCodeOutline } from 'ionicons/icons';
import type { NearbyRoom } from 'network-contracts';
import { normalizeRoomCode } from 'network-contracts';
import ScreenHeader from '../layout/ScreenHeader.vue';

const props = defineProps<{
  nearbyRooms: readonly NearbyRoom[];
  isSubmitting?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  submit: [roomCode: string, playerName: string];
}>();

const playerName = shallowRef('Maya');
const rawCode = shallowRef('K4');
const roomCode = computed(() => normalizeRoomCode(rawCode.value));

function selectRoom(room: NearbyRoom) {
  rawCode.value = room.code;
}

function submit() {
  emit('submit', roomCode.value, playerName.value);
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
          :maxlength="4"
          placeholder="K4--"
        />
      </label>

      <IonButton
        class="scan-button"
        expand="block"
        fill="outline"
        type="button"
      >
        <IonIcon
          slot="start"
          :icon="qrCodeOutline"
        />
        Scan QR code
      </IonButton>

      <div class="section-rule">
        <span>Nearby rooms</span>
      </div>

      <div class="nearby-list">
        <button
          v-for="room in props.nearbyRooms"
          :key="room.code"
          class="nearby-room"
          type="button"
          @click="selectRoom(room)"
        >
          <span class="nearby-room__avatar">{{ room.hostName.charAt(0) }}</span>
          <span class="nearby-room__details">
            <strong>{{ room.name }}</strong>
            <small>{{ room.transport }} · {{ room.code }}</small>
          </span>
          <span
            class="nearby-room__quality"
            :class="`nearby-room__quality--${room.connection}`"
          >● {{ room.connection }}</span>
        </button>
      </div>

      <IonButton
        class="primary-button"
        expand="block"
        type="submit"
        :disabled="roomCode.length !== 4 || props.isSubmitting"
      >
        {{ props.isSubmitting ? 'Joiningâ€¦' : 'Join Room' }}
      </IonButton>
    </form>
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
  letter-spacing: 0.85em;
}

.scan-button {
  min-height: 3.25rem;
  --border-color: var(--color-action);
  --border-radius: 0.85rem;
  --color: var(--color-action);
}

.section-rule {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.7rem;
  color: var(--color-text-muted);
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.section-rule::before,
.section-rule::after {
  height: 1px;
  background: var(--color-card-border);
  content: '';
}

.nearby-list {
  display: grid;
  gap: 0.7rem;
}

.nearby-room {
  display: grid;
  min-height: 4.25rem;
  grid-template-columns: 2.7rem 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--color-card-border);
  border-radius: 0.9rem;
  background: var(--color-card);
  color: var(--color-ink);
  cursor: pointer;
  text-align: left;
}

.nearby-room__avatar {
  display: grid;
  width: 2.7rem;
  aspect-ratio: 1;
  place-items: center;
  border-radius: 0.65rem;
  background: var(--color-surface);
  color: var(--color-action);
  font-weight: 700;
}

.nearby-room__details {
  display: grid;
  gap: 0.1rem;
}

.nearby-room__details small {
  color: var(--color-text-muted);
  text-transform: capitalize;
}

.nearby-room__quality {
  color: var(--color-success);
  font-size: 0.68rem;
  text-transform: capitalize;
}

.nearby-room__quality--weak {
  color: var(--color-turn);
}
</style>
