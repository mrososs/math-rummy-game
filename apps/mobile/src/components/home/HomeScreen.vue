<script setup lang="ts">
import { IonButton, IonIcon } from '@ionic/vue';
import { helpCircleOutline, settingsOutline } from 'ionicons/icons';

const props = defineProps<{
  hasGame: boolean;
  playerName: string;
  botCount: number;
}>();

const emit = defineEmits<{
  createRoom: [];
  joinRoom: [];
  resumeGame: [];
  playBots: [];
  openHelp: [];
  openSettings: [];
}>();
</script>

<template>
  <div class="home-screen safe-area-block">
    <header class="home-screen__utility">
      <IonButton
        fill="clear"
        aria-label="How to play"
        @click="emit('openHelp')"
      >
        <IonIcon
          slot="icon-only"
          :icon="helpCircleOutline"
        />
      </IonButton>
      <IonButton
        fill="clear"
        aria-label="Settings"
        @click="emit('openSettings')"
      >
        <IonIcon
          slot="icon-only"
          :icon="settingsOutline"
        />
      </IonButton>
    </header>

    <main class="home-screen__main">
      <section
        class="wordmark"
        aria-labelledby="game-title"
      >
        <div
          class="wordmark__cards"
          aria-hidden="true"
        >
          <span class="wordmark__card wordmark__card--left">7</span>
          <span class="wordmark__card wordmark__card--operator">+</span>
          <span class="wordmark__card wordmark__card--right">5</span>
        </div>
        <h1
          id="game-title"
          class="wordmark__title"
        >
          Math Rummy
        </h1>
        <p class="wordmark__meta">
          Progressive · Real cards · 2–8
        </p>
      </section>

      <section
        class="home-screen__actions"
        aria-label="Choose a game"
      >
        <IonButton
          class="primary-button"
          expand="block"
          @click="emit('playBots')"
        >
          Play with {{ props.botCount }} bot{{
            props.botCount === 1 ? '' : 's'
          }}
        </IonButton>
        <p class="practice-note">
          {{ props.playerName }}, this match works offline and uses the full
          rule engine.
        </p>
        <IonButton
          class="secondary-button"
          expand="block"
          fill="outline"
          @click="emit('createRoom')"
        >
          Create player room
        </IonButton>
        <button
          class="join-button"
          type="button"
          @click="emit('joinRoom')"
        >
          Join with a room code
        </button>
        <button
          v-if="props.hasGame"
          class="resume-button"
          type="button"
          @click="emit('resumeGame')"
        >
          <span>Resume last game</span>
          <strong>Return ›</strong>
        </button>
      </section>
    </main>

    <footer class="home-screen__footer">
      <button
        type="button"
        @click="emit('openHelp')"
      >
        How to play
      </button>
      <button
        type="button"
        @click="emit('openSettings')"
      >
        Settings
      </button>
    </footer>
  </div>
</template>

<style scoped>
.home-screen {
  display: grid;
  min-height: 100%;
  grid-template-rows: auto 1fr auto;
  color: #f7fafc;
}

.home-screen__utility,
.home-screen__footer {
  display: flex;
  justify-content: space-between;
}

.home-screen__utility ion-button {
  width: 2.75rem;
  height: 2.75rem;
  margin: 0;
  --color: #dbe6f1;
  --padding-start: 0;
  --padding-end: 0;
}

.home-screen__main {
  display: grid;
  width: min(100%, 25rem);
  align-content: center;
  gap: clamp(2.25rem, 7vh, 4rem);
  margin: 0 auto;
}

.wordmark {
  text-align: center;
}

.wordmark__cards {
  position: relative;
  width: 10rem;
  height: 5.7rem;
  margin: 0 auto 1.1rem;
}

.wordmark__card {
  position: absolute;
  top: 0.5rem;
  left: 50%;
  display: grid;
  width: 3.25rem;
  aspect-ratio: 0.72;
  place-items: center;
  border: 1px solid var(--color-card-border);
  border-radius: 0.65rem;
  background: var(--color-card);
  box-shadow: 0 0.8rem 1.4rem -0.8rem rgb(0 0 0 / 65%);
  color: var(--color-navy);
  font-family: var(--font-display);
  font-size: 1.6rem;
  font-weight: 700;
}

.wordmark__card--left {
  transform: translateX(-135%) rotate(-8deg);
}

.wordmark__card--operator {
  z-index: 2;
  border-color: var(--color-turn);
  background: var(--color-turn);
  transform: translateX(-50%);
}

.wordmark__card--right {
  transform: translateX(35%) rotate(8deg);
}

.wordmark__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2rem, 9vw, 2.6rem);
  letter-spacing: -0.04em;
  line-height: 1;
}

.wordmark__meta {
  margin: 0.55rem 0 0;
  color: #9eb2c6;
  font-size: 0.8rem;
}

.home-screen__actions {
  display: grid;
  gap: 0.75rem;
}

.practice-note {
  margin: -0.2rem 0 0.35rem;
  color: #abc0d3;
  font-size: 0.72rem;
  line-height: 1.45;
  text-align: center;
}

.join-button {
  min-height: 2.75rem;
  border: 0;
  background: transparent;
  color: #c1d2e2;
  cursor: pointer;
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: #496a89;
  text-underline-offset: 0.25rem;
}

.resume-button {
  display: flex;
  min-height: 3rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.2rem 1rem;
  border: 0;
  border-radius: 0.78rem;
  background: #1b3b60;
  color: #c9d7e5;
  cursor: pointer;
}

.resume-button strong {
  color: var(--color-turn);
  font-size: 0.78rem;
}

.home-screen__footer button {
  min-height: 2.75rem;
  padding: 0 0.4rem;
  border: 0;
  background: transparent;
  color: #9eb2c6;
  cursor: pointer;
}

.join-button:focus-visible,
.home-screen__footer button:focus-visible,
.resume-button:focus-visible {
  outline: 3px solid var(--color-turn);
  outline-offset: 2px;
}

@media (min-width: 48rem) {
  .home-screen__main {
    width: min(100%, 28rem);
  }
}
</style>
