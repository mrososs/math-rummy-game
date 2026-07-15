<script setup lang="ts">
import { computed } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { useGameStore } from 'game-state';
import { useRoomStore } from 'room-state';
import HomeScreen from '../components/home/HomeScreen.vue';
import { useSettingsStore } from '../stores/use-settings-store';

const router = useRouter();
const gameStore = useGameStore();
const roomStore = useRoomStore();
const settingsStore = useSettingsStore();
const hasGame = computed(() => Boolean(gameStore.match));
const resumeTarget = computed(() =>
  roomStore.room.code === 'BOTS' ? '/game?mode=bots' : '/game',
);
</script>

<template>
  <IonPage>
    <IonContent
      :fullscreen="true"
      class="screen-content--navy"
    >
      <HomeScreen
        class="screen-frame"
        :has-game="hasGame"
        :player-name="settingsStore.playerName"
        :bot-count="settingsStore.botCount"
        @play-bots="router.push('/game?mode=bots&new=1')"
        @create-room="router.push('/room/create')"
        @join-room="router.push('/room/join')"
        @resume-game="router.push(resumeTarget)"
        @open-help="router.push('/help')"
        @open-settings="router.push('/settings')"
      />
    </IonContent>
  </IonPage>
</template>
