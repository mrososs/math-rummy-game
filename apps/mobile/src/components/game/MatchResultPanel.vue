<script setup lang="ts">
import { IonButton } from '@ionic/vue';

const props = defineProps<{
  round: number;
  winnerName?: string;
}>();

const emit = defineEmits<{
  nextRound: [];
  home: [];
}>();
</script>

<template>
  <section
    class="result-panel safe-area-block"
    aria-labelledby="result-title"
  >
    <div
      class="result-mark"
      aria-hidden="true"
    >
      <span>{{ props.round }}</span>
      <small>ROUND</small>
    </div>
    <p class="eyebrow">
      Cards down
    </p>
    <h1 id="result-title">
      {{
        props.winnerName
          ? `${props.winnerName} wins the match`
          : 'Round complete'
      }}
    </h1>
    <p class="result-copy">
      Players who completed their phase move forward. Everyone else gets another
      shot at the same challenge.
    </p>
    <div class="result-actions">
      <IonButton
        v-if="!props.winnerName"
        class="primary-button"
        expand="block"
        @click="emit('nextRound')"
      >
        Start next round
      </IonButton>
      <IonButton
        fill="clear"
        expand="block"
        @click="emit('home')"
      >
        Return home
      </IonButton>
    </div>
  </section>
</template>

<style scoped>
.result-panel {
  display: grid;
  min-height: 100%;
  place-content: center;
  justify-items: center;
  gap: 1rem;
  background: var(--color-navy);
  color: #eef5fb;
  text-align: center;
}

.result-mark {
  display: grid;
  width: 6.5rem;
  aspect-ratio: 0.72;
  place-content: center;
  border: 1px solid #d8e1e9;
  border-radius: 0.75rem;
  background: var(--color-card);
  box-shadow: 0 1.1rem 2rem -1rem rgb(0 0 0 / 60%);
  color: var(--color-navy);
  transform: rotate(-3deg);
}

.result-mark span {
  font-family: var(--font-display);
  font-size: 2.7rem;
  font-weight: 800;
  line-height: 1;
}

.result-mark small {
  margin-top: 0.35rem;
  color: var(--color-action-strong);
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.result-panel h1,
.result-panel p {
  margin: 0;
}

.result-panel h1 {
  max-width: 16ch;
  font-family: var(--font-display);
  font-size: 2rem;
  letter-spacing: -0.035em;
}

.result-copy {
  max-width: 36ch;
  color: #b7cadb;
  line-height: 1.55;
}

.result-actions {
  display: grid;
  width: min(100%, 20rem);
  gap: 0.4rem;
  margin-top: 1rem;
}

.result-actions ion-button {
  margin: 0;
  --color: #dce8f2;
}
</style>
