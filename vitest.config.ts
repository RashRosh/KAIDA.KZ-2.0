import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    projects: [
      { extends: true, test: { name: 'unit', environment: 'node', include: ['tests/unit/**/*.test.ts'] } },
      { extends: true, test: { name: 'integration', environment: 'node', include: ['tests/integration/**/*.test.ts'], fileParallelism: false, hookTimeout: 30000 } },
    ],
  },
});
