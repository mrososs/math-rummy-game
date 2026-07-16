<script setup lang="ts">
import { IonContent, IonPage, IonToast } from '@ionic/vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useRoomStore } from 'room-state';
import type { CreateRoomInput } from 'network-contracts';
import CreateRoomForm from '../components/room/CreateRoomForm.vue';
import { useSettingsStore } from '../stores/use-settings-store';

const router = useRouter();
const roomStore = useRoomStore();
const settingsStore = useSettingsStore();
const { errorMessage, isLoading } = storeToRefs(roomStore);

async function createRoom(input: CreateRoomInput) {
  if (await roomStore.createRoom(input)) await router.push('/room/lobby');
}
</script>

<template>
  <IonPage>
    <IonContent
      :fullscreen="true"
      class="screen-content"
    >
      <CreateRoomForm
        :is-submitting="isLoading"
        :initial-name="settingsStore.playerName"
        class="screen-frame"
        @back="router.back()"
        @submit="createRoom"
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
