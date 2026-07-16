<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { playSound } from '../composables/useSound';

// A single delegated listener gives every button a tap sound. Cards play their
// own select/deselect sound, so they are excluded here.
function onGlobalClick(event: Event): void {
  const target = event.target as HTMLElement | null;
  const control = target?.closest(
    'button, ion-button, ion-segment-button, [role="button"]',
  );
  if (!control || control.closest('.playing-card')) return;
  playSound('button');
}

onMounted(() => document.addEventListener('click', onGlobalClick, true));
onBeforeUnmount(() => document.removeEventListener('click', onGlobalClick, true));
</script>

<template>
  <IonApp>
    <IonRouterOutlet />
  </IonApp>
</template>
