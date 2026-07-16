<script setup lang="ts">
import { computed } from 'vue';
import { IonButton, IonIcon } from '@ionic/vue';
import { copyOutline, wifiOutline } from 'ionicons/icons';
import type { RoomSnapshot } from 'network-contracts';
import { useRoomQr } from 'room-state';
import { PlayerBadge } from 'shared-ui';
import ScreenHeader from '../layout/ScreenHeader.vue';
import { useToast } from '../../composables/useToast';

const props = defineProps<{
  room: RoomSnapshot;
  currentPlayerId: string;
  canStart: boolean;
  isHost: boolean;
  isBusy?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  toggleReady: [];
  start: [];
}>();

const roomCode = computed(() => props.room.code);
const { dataUrl: qrDataUrl } = useRoomQr(roomCode);
const toast = useToast();

async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.room.code);
    await toast.success('Room code copied.');
  } catch {
    await toast.error('Could not copy the code — copy it manually.');
  }
}
const currentPlayer = computed(() =>
  props.room.players.find((player) => player.id === props.currentPlayerId),
);
const waitingNames = computed(() =>
  props.room.players
    .filter((player) => !player.isHost && !player.isReady)
    .map((player) => player.name),
);
</script>

<template>
  <div class="lobby">
    <ScreenHeader
      title="Lobby"
      eyebrow="Local room"
      @back="emit('back')"
    >
      <template #end>
        <span
          class="lobby__live"
          aria-label="Room is online"
        >●</span>
      </template>
    </ScreenHeader>

    <main class="lobby__body safe-area-block">
      <section
        class="lobby-code"
        aria-label="Room code"
      >
        <div>
          <span class="lobby-code__label">Room code</span>
          <strong>{{ props.room.code }}</strong>
        </div>
        <img
          v-if="qrDataUrl"
          :src="qrDataUrl"
          :alt="`QR code for room ${props.room.code}`"
        >
        <button
          type="button"
          aria-label="Copy room code"
          @click="copyCode"
        >
          <IonIcon :icon="copyOutline" />
        </button>
      </section>

      <div class="lobby-meta">
        <span><IonIcon :icon="wifiOutline" /> Online</span>
        <span>{{ props.room.players.length }}/{{
          props.room.maxPlayers
        }}
          players</span>
      </div>

      <section
        class="player-list"
        aria-labelledby="players-title"
      >
        <div class="player-list__heading">
          <h2 id="players-title">
            Players
          </h2>
          <span>Ready</span>
        </div>
        <article
          v-for="player in props.room.players"
          :key="player.id"
          class="player-row"
        >
          <PlayerBadge
            :player="player"
            :show-connection="true"
          />
          <span
            v-if="player.isHost"
            class="status-pill status-pill--host"
          >Host</span>
          <span
            v-else-if="player.isReady"
            class="status-pill status-pill--ready"
          >Ready</span>
          <span
            v-else
            class="status-pill status-pill--waiting"
          >Waiting</span>
        </article>
      </section>

      <div class="lobby__actions">
        <IonButton
          v-if="props.isHost"
          class="primary-button"
          expand="block"
          :disabled="!props.canStart || props.isBusy"
          @click="emit('start')"
        >
          {{ props.isBusy ? 'Startingâ€¦' : 'Start Game' }}
        </IonButton>
        <IonButton
          v-else
          class="primary-button"
          expand="block"
          :disabled="props.isBusy"
          @click="emit('toggleReady')"
        >
          {{ currentPlayer?.isReady ? 'Not Ready' : 'I’m Ready' }}
        </IonButton>
        <p v-if="waitingNames.length">
          Waiting on {{ waitingNames.join(' & ') }} to get ready
        </p>
        <p v-else>
          Everyone is ready
        </p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.lobby {
  min-height: 100%;
  background: var(--color-surface-soft);
}

.lobby__live {
  color: var(--color-success);
  font-size: 0.75rem;
}

.lobby__body {
  display: grid;
  gap: 1rem;
}

.lobby-code {
  display: grid;
  grid-template-columns: 1fr 3.75rem 2.75rem;
  align-items: center;
  gap: 0.7rem;
  padding: 0.8rem;
  border-radius: 1rem;
  background: var(--color-navy);
  color: #f8fafc;
}

.lobby-code__label {
  display: block;
  color: #9eb2c6;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.lobby-code strong {
  display: block;
  margin-top: 0.1rem;
  font-family: var(--font-display);
  font-size: 1.85rem;
  letter-spacing: 0.15em;
}

.lobby-code img {
  width: 3.75rem;
  border-radius: 0.45rem;
}

.lobby-code button {
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid #3d5f80;
  border-radius: 0.72rem;
  background: transparent;
  color: #dbe6f1;
  cursor: pointer;
}

.lobby-meta {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--color-text-muted);
  font-size: 0.76rem;
  text-transform: capitalize;
}

.lobby-meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.player-list {
  display: grid;
  gap: 0.55rem;
}

.player-list__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.25rem;
}

.player-list__heading h2,
.player-list__heading span {
  margin: 0;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.player-row {
  display: grid;
  min-height: 4rem;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid #e2e8ee;
  border-radius: 0.85rem;
  background: var(--color-card);
}

.status-pill {
  min-width: 3.6rem;
  padding: 0.3rem 0.45rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  text-align: center;
}

.status-pill--host {
  background: var(--color-surface);
  color: var(--color-action);
}

.status-pill--ready {
  background: #e6f4e7;
  color: var(--color-success);
}

.status-pill--waiting {
  background: #fff1d9;
  color: #a55f00;
}

.lobby__actions {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.25rem;
}

.lobby__actions p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.7rem;
  text-align: center;
}
</style>
