import '@fontsource-variable/manrope/index.css';
import '@fontsource-variable/space-grotesk/index.css';
import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';
import '@ionic/vue/css/display.css';
import './styles.css';

import { IonicVue } from '@ionic/vue';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './app/App.vue';
import { createConfiguredGameBackend } from './app/game-backend';
import router from './router';
import { useRoomStore } from 'room-state';
import { useSettingsStore } from './stores/use-settings-store';

const app = createApp(App);
const pinia = createPinia();
app.use(IonicVue).use(pinia).use(router);

const gameBackend = createConfiguredGameBackend();
if (gameBackend) useRoomStore(pinia).configureBackend(gameBackend);
useSettingsStore(pinia).applyPreferences();

router.isReady().then(() => {
  app.mount('#root');
});
