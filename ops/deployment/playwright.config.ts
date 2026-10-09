import { defineConfig } from '@playwright/test';
import { returningVisitorState } from '../../tests/e2e/browser-state';

// R3 acceptance: adapted R1 smoke and TLS checks against the already running isolated stack.
// No host DB connection: the smoke reads origins/photo files through the named containers with docker exec.
const base = process.env.KAIDA_SMOKE_BASE_URL;
if (!base) throw new Error('KAIDA_SMOKE_BASE_URL is required (for example https://localhost:8443).');
if (process.env.DATABASE_URL) throw new Error('DATABASE_URL must not be set for the deployment smoke.');

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    baseURL: base,
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: returningVisitorState,
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  },
});
