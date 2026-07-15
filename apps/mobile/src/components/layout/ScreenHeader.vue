<script setup lang="ts">
import { IonButton, IonIcon } from '@ionic/vue';
import { arrowBack } from 'ionicons/icons';

const props = defineProps<{
  title: string;
  eyebrow?: string;
}>();

const emit = defineEmits<{
  back: [];
}>();
</script>

<template>
  <header class="screen-header safe-area-block">
    <IonButton
      class="screen-header__back"
      fill="clear"
      aria-label="Go back"
      @click="emit('back')"
    >
      <IonIcon
        slot="icon-only"
        :icon="arrowBack"
      />
    </IonButton>
    <div class="screen-header__title-group">
      <span
        v-if="props.eyebrow"
        class="screen-header__eyebrow"
      >{{
        props.eyebrow
      }}</span>
      <h1 class="screen-header__title">
        {{ props.title }}
      </h1>
    </div>
    <slot name="end" />
  </header>
</template>

<style scoped>
.screen-header {
  display: grid;
  min-height: 5.35rem;
  grid-template-columns: 2.75rem 1fr auto;
  align-items: center;
  gap: 0.65rem;
  padding-bottom: 1rem;
  background: var(--color-navy);
  color: #f7fafc;
}

.screen-header__back {
  width: 2.75rem;
  height: 2.75rem;
  margin: 0;
  --color: #dbe6f1;
  --padding-start: 0;
  --padding-end: 0;
}

.screen-header__title-group {
  display: grid;
  gap: 0.1rem;
}

.screen-header__eyebrow {
  color: var(--color-turn);
  font-family: var(--font-display);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.screen-header__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.25rem;
  line-height: 1.1;
}
</style>
