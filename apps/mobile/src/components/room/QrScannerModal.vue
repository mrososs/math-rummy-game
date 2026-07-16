<script setup lang="ts">
// Scans a room QR via the device camera using getUserMedia, which works in the
// browser and inside the Capacitor WebView. When native platforms are added
// (`cap add`), declare camera permissions so the WebView may open the camera:
//   Android: <uses-permission android:name="android.permission.CAMERA"/>
//   iOS: NSCameraUsageDescription in Info.plist
import { onBeforeUnmount, ref } from 'vue';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
} from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { normalizeRoomCode } from 'network-contracts';

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{
  close: [];
  scanned: [code: string];
}>();

const video = ref<HTMLVideoElement | null>(null);
const status = ref<'scanning' | 'error'>('scanning');
const message = ref('Point your camera at a room QR code.');
let controls: IScannerControls | undefined;

/** Pulls a 4-char room code out of a `math-rummy://join?room=CODE` QR or raw text. */
function extractCode(text: string): string {
  const match = text.match(/room=([A-Za-z0-9]+)/i);
  return normalizeRoomCode(match ? match[1] : text);
}

async function start(): Promise<void> {
  status.value = 'scanning';
  message.value = 'Point your camera at a room QR code.';
  if (!video.value) return;
  try {
    const reader = new BrowserQRCodeReader();
    controls = await reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } },
      video.value,
      (result) => {
        if (!result) return;
        const code = extractCode(result.getText());
        if (code.length === 4) {
          emit('scanned', code);
          emit('close');
        }
      },
    );
  } catch {
    status.value = 'error';
    message.value =
      'Camera unavailable. Allow camera access or enter the code manually.';
  }
}

function stop(): void {
  controls?.stop();
  controls = undefined;
}

function handleDismiss(): void {
  stop();
  emit('close');
}

onBeforeUnmount(stop);
</script>

<template>
  <IonModal
    :is-open="props.isOpen"
    @did-present="start"
    @did-dismiss="handleDismiss"
  >
    <IonHeader>
      <IonToolbar>
        <IonTitle>Scan room code</IonTitle>
        <IonButtons slot="end">
          <IonButton
            aria-label="Close scanner"
            @click="emit('close')"
          >
            <IonIcon
              slot="icon-only"
              :icon="closeOutline"
            />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent class="scanner">
      <div class="scanner__stage">
        <video
          ref="video"
          class="scanner__video"
          muted
          autoplay
          playsinline
        />
        <div
          class="scanner__reticle"
          :class="{ 'scanner__reticle--error': status === 'error' }"
          aria-hidden="true"
        />
      </div>
      <p
        class="scanner__status"
        role="status"
      >
        {{ message }}
      </p>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.scanner {
  --background: #05101f;
  --color: #f2f7fb;
}

.scanner__stage {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1;
  max-height: 70vh;
  overflow: hidden;
  background: #000;
}

.scanner__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scanner__reticle {
  position: absolute;
  width: min(62vw, 16rem);
  aspect-ratio: 1;
  border: 3px solid var(--color-turn, #f59e0b);
  border-radius: 1.1rem;
  box-shadow: 0 0 0 100vmax rgb(0 0 0 / 45%);
}

.scanner__reticle--error {
  border-color: var(--color-error, #c62828);
}

.scanner__status {
  margin: 1rem;
  color: #cde0f2;
  font-size: 0.85rem;
  text-align: center;
}
</style>
