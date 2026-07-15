import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/room/state',
  plugins: [vue()],
  resolve: { tsconfigPaths: true },
  test: {
    name: 'room-state',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/room/state',
      provider: 'v8' as const,
    },
  },
}));
