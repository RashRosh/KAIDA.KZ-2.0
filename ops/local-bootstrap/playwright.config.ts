import 'dotenv/config';
import { defineConfig } from '@playwright/test';
import { returningVisitorState } from '../../tests/e2e/browser-state';
import { assertIsolatedDatabase, requirePhotoStorageDirectory } from './isolation';

// R1 production smoke of the existing manual Seller → Buyer path (docs/ops/LOCAL_BOOTSTRAP.md). Runs on a production
// build against the isolated bootstrap stack only; not part of `pnpm verify` or the default CI.
assertIsolatedDatabase();
requirePhotoStorageDirectory();

const port = process.env.KAIDA_SMOKE_PORT ?? '3200';

export default defineConfig({
  testDir: '.',
  testMatch: 'smoke.spec.ts',
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
  // The server reads DATABASE_URL, IDENTITY_OTP_HMAC_SECRET_HEX, PHOTO_STORAGE_DIR, OPERATOR_PHONES and the rest from the
  // process environment / the checkout's .env (the runbook sets them); `pnpm build` must have run first.
  webServer: {
    command: `pnpm start --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
