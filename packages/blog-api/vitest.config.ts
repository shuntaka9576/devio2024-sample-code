import dotenv from '@dotenvx/dotenvx';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: dotenv.config({ path: '.env.dev' }).parsed,
    name: 'unit',
    dir: 'src',
    globals: true,
    testTimeout: 100_000_000,
    coverage: {
      include: ['src/**/*.ts'],
      reporter: ['json'],
    },
    globalSetup: 'tests/setup/global-setup.ts',
    reporters: 'verbose',
  },
});
