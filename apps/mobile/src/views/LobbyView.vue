<script setup lang="ts">
import { computed, watch } from 'vue';
import { IonContent, IonPage, IonToast } from '@ionic/vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useGameStore } from 'game-state';
import { useRoomStore } from 'room-state';
import LobbyPanel from '../components/room/LobbyPanel.vue';

const router = useRouter();
const roomStore = useRoomStore();
const gameStore = useGameStore();
const { errorMessage, isLoading, room, currentPlayerId } =
  storeToRefs(roomStore);
const canStart = computed(() => roomStore.canStart);
const isHost = computed(() => roomStore.isHost);

async function startGame() {
  // Online: the server shuffles and deals; the client uploads nothing.
  if (roomStore.backendEnabled) {
    if (await roomStore.startGame()) {
      await router.push('/game');
    }
    return;
  }
  // Offline/local: build the match on-device.
  gameStore.initializeGame(
    room.value.players.map(({ id, name, seat }) => ({ id, name, seat })),
    currentPlayerId.value,
    { seed: `room-${room.value.code}`, phaseId: 1, useDemoHand: false },
  );
  if (gameStore.match && (await roomStore.startGame(gameStore.match))) {
    await router.push('/game');
  }
}

async function leaveRoom() {
  await roomStore.leaveRoom();
  await router.push('/');
}

watch(
  () => room.value.status,
  async (status) => {
    if (status === 'playing' && router.currentRoute.value.path !== '/game') {
      await router.push('/game');
    }
  },
);
</script>

<template>
  <IonPage>
    <IonContent
      :fullscreen="true"
      class="screen-content"
    >
      <LobbyPanel
        :room="room"
        :current-player-id="currentPlayerId"
        :can-start="canStart"
        :is-host="isHost"
        :is-busy="isLoading"
        class="screen-frame"
        @back="leaveRoom"
        @toggle-ready="roomStore.toggleReady()"
        @start="startGame"
      />
      <IonToast
        :is-open="Boolean(errorMessage)"
        :message="errorMessage"
        :duration="3500"
        color="danger"
        @did-dismiss="roomStore.clearError()"
      />
    </IonContent>
  </IonPage>
</template>
