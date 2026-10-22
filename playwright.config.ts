import { defineConfig } from '@playwright/test';
import { NEARBY_RADIUS_METERS_DEFAULT } from './src/modules/discovery/config/discovery.config';
import { testDatabaseUrl } from './tests/integration/database';
import { returningVisitorState } from './tests/e2e/browser-state';
import { REAL_PARSER_E2E_PHONES, REPLAY_STUB_PORT } from './tests/e2e/real-parser-e2e';

const identityTestSecret = '1111111111111111111111111111111111111111111111111111111111111111';
// seller-ai-text-real-parser: test-only key of the loopback replay stub (never used outside E2E).
const replayStubKey = 'e2e-replay-stub-key-0000000000000000000000';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Flows start as a returning visitor: the language chosen (Russian) and First Entry already shown (stage 6B, one
    // central definition in tests/e2e/browser-state.ts). First Entry itself is covered from `firstVisitState`.
    storageState: returningVisitorState,
  },
  projects: [
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  ],
  // Two instances of one build: the default with the comment translator off (every existing flow must pass that
  // way) and one with the deterministic fake translator for seller-comment-translation.spec.ts. The second one also
  // runs seller text input in `real` mode against the loopback REPLAY stub (saved C2 answers, not a model) for
  // seller-text-real-parser.spec.ts; only the allowlisted test phones see it, everyone else sees it off.
  webServer: [...[false, true].map((translatorOn) => ({
    command: `pnpm start --hostname 127.0.0.1 --port ${translatorOn ? 3101 : 3100}`,
    url: `http://127.0.0.1:${translatorOn ? 3101 : 3100}`,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      SELLER_COMMENT_TRANSLATOR: translatorOn ? 'fake' : 'off',
      SELLER_TEXT_INPUT: translatorOn ? 'real' : 'fake',
      ...(translatorOn ? {
        SELLER_TEXT_PARSER_URL: `http://127.0.0.1:${REPLAY_STUB_PORT}`,
        SELLER_TEXT_PARSER_API_KEY: replayStubKey,
        SELLER_TEXT_PARSER_TIMEOUT_MS: '10000',
        SELLER_TEXT_PARSER_CONCURRENCY: '4',
        SELLER_TEXT_INPUT_ALLOWLIST: REAL_PARSER_E2E_PHONES.join(','),
      } : {}),
      DATABASE_URL: testDatabaseUrl(),
      NEARBY_RADIUS_METERS: String(NEARBY_RADIUS_METERS_DEFAULT),
      IDENTITY_OTP_TTL_SECONDS: '300',
      IDENTITY_SESSION_TTL_SECONDS: '2592000',
      IDENTITY_OTP_HMAC_SECRET_HEX: identityTestSecret,
      IDENTITY_COOKIE_SECURE: 'false',
      NEXT_TELEMETRY_DISABLED: '1',
      OPERATOR_PHONES: '+77000038001,+77000039001,+77000991303',
      // S15C / D0: events written by E2E runs are test data, never organic demand.
      SEARCH_EVENTS_ORIGIN: 'test',
      BUYER_REPORTS_LOCAL_TESTING: '1',
      // actuality-reminders: a test-only key pair (never used outside E2E) so the push button is shown.
      WEB_PUSH_VAPID_PUBLIC_KEY: 'BLqKKgoWp-Aio77mIlsfMm28kKhUg8cH52VsM5gMKE_WkKwy9jcxiz2S9ZaTA4QCL4_FXmgzOQd8BWlPYUvTpKE',
      WEB_PUSH_VAPID_PRIVATE_KEY: 'YSEabg270nHHi3ihJu2Pytv1hlIGROYZwnynExHsg7U',
      WEB_PUSH_SUBJECT: 'mailto:e2e@kaida.invalid',
    },
  })), {
    command: `pnpm exec tsx tests/support/c2-replay-stub-server.ts ${REPLAY_STUB_PORT}`,
    url: `http://127.0.0.1:${REPLAY_STUB_PORT}/__stats`,
    reuseExistingServer: false,
    timeout: 60000,
    env: { STUB_PARSER_API_KEY: replayStubKey },
  }],
});
