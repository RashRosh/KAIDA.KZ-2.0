import 'dotenv/config';
import { defineConfig } from '@playwright/test';
import { returningVisitorState } from '../../tests/e2e/browser-state';
import { assertIsolatedDatabase, requirePhotoStorageDirectory } from '../local-bootstrap/isolation';

// R2: read-only check of an application running on a RESTORED installation (docs/ops/BACKUP_RESTORE.md). Same guards as the R1
// smoke: it refuses the development stack. Not part of `pnpm verify` or the default CI.
assertIsolatedDatabase();
requirePhotoStorageDirectory();

const port = process.env.KAIDA_R2_APP_PORT ?? '3202';

export default defineConfig({
  testDir: '.',
  testMatch: 'restored.spec.ts',
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: returningVisitorState,
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  },
  // The restored application is normally already running (the runbook starts it so a person can look at it); otherwise the
  // config starts it from the process environment (DATABASE_URL, PHOTO_STORAGE_DIR, IDENTITY_OTP_HMAC_SECRET_HEX, ...).
  webServer: {
    command: `pnpm start --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
