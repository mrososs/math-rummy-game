import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/game/state',
  plugins: [vue()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      'game-domain': fileURLToPath(
        new URL('../domain/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    name: 'game-state',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/game/state',
      provider: 'v8' as const,
    },
  },
}));
