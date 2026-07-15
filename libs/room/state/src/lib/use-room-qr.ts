import QRCode from 'qrcode';
import { readonly, shallowRef, toRef, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

export function useRoomQr(roomCode: MaybeRefOrGetter<string>) {
  const dataUrl = shallowRef('');
  const isGenerating = shallowRef(false);

  watch(
    toRef(roomCode),
    async (code, _previousCode, onCleanup) => {
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });

      if (!code) {
        dataUrl.value = '';
        return;
      }

      isGenerating.value = true;
      try {
        const nextUrl = await QRCode.toDataURL(
          `math-rummy://join?room=${encodeURIComponent(code)}`,
          {
            color: { dark: '#0B2545', light: '#F8FAFC' },
            margin: 1,
            width: 256,
          },
        );
        if (!cancelled) dataUrl.value = nextUrl;
      } finally {
        if (!cancelled) isGenerating.value = false;
      }
    },
    { immediate: true },
  );

  return {
    dataUrl: readonly(dataUrl),
    isGenerating: readonly(isGenerating),
  };
}
