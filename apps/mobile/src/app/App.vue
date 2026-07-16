<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { playSound, unlockAudio } from '../composables/useSound';

// WebViews require a user gesture to start audio; unlock on the first touch.
function onFirstGesture(): void {
  unlockAudio();
}

// A single delegated listener gives every button a tap sound. Cards play their
// own select/deselect sound, so they are excluded here.
function onGlobalClick(event: Event): void {
  unlockAudio();
  const target = event.target as HTMLElement | null;
  const control = target?.closest(
    'button, ion-button, ion-segment-button, [role="button"]',
  );
  if (!control || control.closest('.playing-card')) return;
  playSound('button');
}

onMounted(() => {
  document.addEventListener('pointerdown', onFirstGesture, true);
  document.addEventListener('touchend', onFirstGesture, true);
  document.addEventListener('click', onGlobalClick, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onFirstGesture, true);
  document.removeEventListener('touchend', onFirstGesture, true);
  document.removeEventListener('click', onGlobalClick, true);
});
</script>

<template>
  <IonApp>
    <IonRouterOutlet />
  </IonApp>
</template>
