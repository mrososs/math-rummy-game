<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import GameSettingsPanel from '../components/settings/GameSettingsPanel.vue';
import ScreenHeader from '../components/layout/ScreenHeader.vue';
import { useToast } from '../composables/useToast';
import {
  useSettingsStore,
  type GameSettings,
} from '../stores/use-settings-store';

const router = useRouter();
const settingsStore = useSettingsStore();
const toast = useToast();
const savedMessage = shallowRef('');
const settings = computed<GameSettings>(() => ({ ...settingsStore.$state }));

async function save(nextSettings: GameSettings): Promise<void> {
  const result = await settingsStore.saveSettings(nextSettings);
  if (result.ok) {
    savedMessage.value = result.synced
      ? 'Settings saved to your account.'
      : 'Settings saved on this device.';
    await toast.success(savedMessage.value);
  } else {
    savedMessage.value = '';
    await toast.error(result.error ?? 'Could not save settings.');
  }
}
</script>

<template>
  <IonPage>
    <IonContent
      :fullscreen="true"
      class="screen-content"
    >
      <div class="settings-view screen-frame">
        <ScreenHeader
          title="Settings"
          eyebrow="Your table"
          @back="router.back()"
        />
        <p
          v-if="savedMessage"
          class="save-message"
          role="status"
        >
          {{ savedMessage }}
        </p>
        <GameSettingsPanel
          :settings="settings"
          @save="save"
        />
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.settings-view {
  background: var(--color-surface-soft);
}

.save-message {
  margin: 1rem 1rem 0;
  padding: 0.75rem 1rem;
  border-radius: 0.55rem;
  background: #dcebdc;
  color: #1f5c27;
  font-weight: 700;
}
</style>
