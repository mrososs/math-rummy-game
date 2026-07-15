<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import GameGuide from '../components/help/GameGuide.vue';
import ScreenHeader from '../components/layout/ScreenHeader.vue';

const router = useRouter();
</script>

<template>
  <IonPage>
    <IonContent
      :fullscreen="true"
      class="screen-content"
    >
      <div class="help-view screen-frame">
        <ScreenHeader
          title="How to play"
          eyebrow="Math Rummy"
          @back="router.back()"
        />
        <GameGuide @practice="router.push('/game?mode=bots&new=1')" />
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.help-view {
  background: var(--color-surface-soft);
}
</style>
