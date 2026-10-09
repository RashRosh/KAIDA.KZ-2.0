import { describe, expect, it } from 'vitest';
import { requestRetryAfterSeconds } from '../../src/modules/identity/application/otp-policy';
import { parseIdentityConfig } from '../../src/modules/identity/config/identity.config';

const policy = { intervalSeconds: 60, windowSeconds: 900, requestLimit: 5, maxFailures: 5 };
const at = (seconds: number) => new Date(seconds * 1000);

describe('approved OTP admission policy', () => {
  it('admits the first request and rounds waits upward at the exact interval boundary', () => {
    expect(requestRetryAfterSeconds([], at(0), policy)).toBe(0);
    expect(requestRetryAfterSeconds([at(0)], at(59.999), policy)).toBe(1);
    expect(requestRetryAfterSeconds([at(0)], at(60), policy)).toBe(0);
  });
  it('uses the rolling budget, including history exceeding a newly configured limit', () => {
    expect(requestRetryAfterSeconds([0, 60, 120, 180, 240].map(at), at(300), policy)).toBe(600);
    expect(requestRetryAfterSeconds([0, 60, 120, 180, 240].map(at), at(900), policy)).toBe(0);
    expect(requestRetryAfterSeconds([0, 60, 120, 180, 240, 300].map(at), at(900), policy)).toBe(60);
  });
  it('validates every policy configuration and defaults to the approved values', () => {
    const env = { IDENTITY_OTP_HMAC_SECRET_HEX: '11'.repeat(32) };
    expect(parseIdentityConfig(env)).toMatchObject({ otpRequestIntervalSeconds: 60, otpRequestWindowSeconds: 900, otpRequestLimit: 5, otpMaxFailedAttempts: 5 });
    for (const key of ['IDENTITY_OTP_REQUEST_INTERVAL_SECONDS', 'IDENTITY_OTP_REQUEST_WINDOW_SECONDS', 'IDENTITY_OTP_REQUEST_LIMIT', 'IDENTITY_OTP_MAX_FAILED_ATTEMPTS']) {
      for (const value of ['0', '-1', '1.5', 'abc', String(Number.MAX_SAFE_INTEGER + 1)]) {
        expect(() => parseIdentityConfig({ ...env, [key]: value })).toThrow();
      }
    }
  });
});
