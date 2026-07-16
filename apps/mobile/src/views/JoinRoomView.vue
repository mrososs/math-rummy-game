<script setup lang="ts">
import { IonContent, IonPage, IonToast } from '@ionic/vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useRoomStore } from 'room-state';
import JoinRoomForm from '../components/room/JoinRoomForm.vue';
import { useSettingsStore } from '../stores/use-settings-store';

const router = useRouter();
const roomStore = useRoomStore();
const settingsStore = useSettingsStore();
const { errorMessage, isLoading } = storeToRefs(roomStore);

async function joinRoom(roomCode: string, playerName: string) {
  if (await roomStore.joinRoom(roomCode, playerName)) {
    await router.push('/room/lobby');
  }
}
</script>

<template>
  <IonPage>
    <IonContent
      :fullscreen="true"
      class="screen-content"
    >
      <JoinRoomForm
        :is-submitting="isLoading"
        :initial-name="settingsStore.playerName"
        class="screen-frame"
        @back="router.back()"
        @submit="joinRoom"
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
