import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mathrummy.game',
  appName: 'Math Rummy',
  webDir: '../../dist/apps/mobile',
  bundledWebRuntime: false,
  plugins: {
    Keyboard: {
      resize: 'body',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0B2545',
    },
  },
};

export default config;
