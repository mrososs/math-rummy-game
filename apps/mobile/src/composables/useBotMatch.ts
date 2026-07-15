import { onBeforeUnmount, shallowRef, watch, type ComputedRef } from 'vue';
import { useGameStore } from 'game-state';
import { useRoomStore } from 'room-state';
import { useSettingsStore } from '../stores/use-settings-store';

export function useBotMatch(enabled: ComputedRef<boolean>) {
  const gameStore = useGameStore();
  const roomStore = useRoomStore();
  const settingsStore = useSettingsStore();
  const thinkingBotId = shallowRef('');
  const thinkingBotName = shallowRef('');
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clearBotTimer(): void {
    if (timer) clearTimeout(timer);
    timer = undefined;
    thinkingBotId.value = '';
    thinkingBotName.value = '';
  }

  watch(
    [
      enabled,
      () => gameStore.match?.status,
      () => gameStore.activePlayerState?.id,
      () => gameStore.match?.turnStep,
    ],
    () => {
      clearBotTimer();
      const bot = gameStore.activePlayerState;
      if (
        !enabled.value ||
        gameStore.match?.status !== 'playing' ||
        !bot?.id.startsWith('bot-')
      ) {
        return;
      }

      thinkingBotId.value = bot.id;
      thinkingBotName.value = bot.name;
      const delay = settingsStore.reducedMotion
        ? 500
        : settingsStore.botTurnSpeed === 'quick'
          ? 2000
          : 3500;
      timer = setTimeout(() => {
        gameStore.playBotTurn(bot.id, settingsStore.botDifficulty);
        thinkingBotId.value = '';
        thinkingBotName.value = '';
        if (gameStore.match) void roomStore.publishGameState(gameStore.match);
      }, delay);
    },
    { immediate: true },
  );

  onBeforeUnmount(clearBotTimer);

  return { thinkingBotId, thinkingBotName };
}
