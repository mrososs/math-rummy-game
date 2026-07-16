import { toastController } from '@ionic/vue';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  informationCircleOutline,
} from 'ionicons/icons';

type ToastTone = 'success' | 'danger' | 'medium';

async function present(
  message: string,
  color: ToastTone,
  icon: string,
): Promise<void> {
  const toast = await toastController.create({
    message,
    icon,
    color,
    duration: color === 'danger' ? 3200 : 1900,
    position: 'top',
    buttons: [{ icon: 'close', role: 'cancel' }],
  });
  await toast.present();
}

/** Lightweight success/failure notifications via the Ionic toast controller. */
export function useToast() {
  return {
    success: (message: string) =>
      present(message, 'success', checkmarkCircleOutline),
    error: (message: string) => present(message, 'danger', alertCircleOutline),
    info: (message: string) =>
      present(message, 'medium', informationCircleOutline),
  };
}
