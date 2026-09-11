import { defineConfig } from '@playwright/test';
import { testDatabaseUrl } from './tests/integration/database';

const identityTestSecret = '1111111111111111111111111111111111111111111111111111111111111111';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'pnpm start --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATABASE_URL: testDatabaseUrl(),
      IDENTITY_OTP_TTL_SECONDS: '300',
      IDENTITY_SESSION_TTL_SECONDS: '2592000',
      IDENTITY_OTP_HMAC_SECRET_HEX: identityTestSecret,
      IDENTITY_COOKIE_SECURE: 'false',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
