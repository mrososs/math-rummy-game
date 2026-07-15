import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'apps/**/vite.config.{ts,mts}',
      'libs/**/vite.config.{ts,mts}',
      {
        test: {
          name: 'core-libraries',
          environment: 'node',
          include: [
            'libs/game/domain/src/**/*.spec.ts',
            'libs/network/contracts/src/**/*.spec.ts',
            'libs/backend/data-access/src/**/*.spec.ts',
          ],
        },
      },
    ],
  },
});
