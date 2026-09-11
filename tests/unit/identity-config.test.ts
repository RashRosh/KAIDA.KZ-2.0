import { describe, expect, it } from 'vitest';
import { parseIdentityConfig } from '../../src/modules/identity/config/identity.config';

const SECRET = '11'.repeat(32);

function env(overrides: Record<string, string | undefined> = {}) {
  return { IDENTITY_OTP_HMAC_SECRET_HEX: SECRET, NODE_ENV: 'test', ...overrides };
}

describe('Identity config', () => {
  it('uses technical TTL defaults and non-production cookie default', () => {
    const config = parseIdentityConfig(env());
    expect(config.otpTtlSeconds).toBe(300);
    expect(config.sessionTtlSeconds).toBe(2_592_000);
    expect(config.otpHmacSecret).toEqual(Buffer.from(SECRET, 'hex'));
    expect(config.cookieSecure).toBe(false);
  });

  it.each(['0', '-1', '1.5', 'abc', 'Infinity', String(Number.MAX_SAFE_INTEGER + 1)])('rejects invalid OTP TTL %s', (value) => {
    expect(() => parseIdentityConfig(env({ IDENTITY_OTP_TTL_SECONDS: value }))).toThrow();
  });

  it.each(['0', '-1', '1.5', 'abc', 'Infinity', String(Number.MAX_SAFE_INTEGER + 1)])('rejects invalid session TTL %s', (value) => {
    expect(() => parseIdentityConfig(env({ IDENTITY_SESSION_TTL_SECONDS: value }))).toThrow();
  });

  it('accepts positive integer TTL overrides', () => {
    const config = parseIdentityConfig(env({ IDENTITY_OTP_TTL_SECONDS: '60', IDENTITY_SESSION_TTL_SECONDS: '3600' }));
    expect(config.otpTtlSeconds).toBe(60);
    expect(config.sessionTtlSeconds).toBe(3600);
  });

  it.each([undefined, '', 'aa', 'z'.repeat(64), '11'.repeat(31), '11'.repeat(33)])('rejects missing or invalid HMAC secret', (value) => {
    expect(() => parseIdentityConfig({ ...env(), IDENTITY_OTP_HMAC_SECRET_HEX: value })).toThrow();
  });

  it('defaults Secure on in production and off elsewhere', () => {
    expect(parseIdentityConfig(env({ NODE_ENV: 'production' })).cookieSecure).toBe(true);
    expect(parseIdentityConfig(env({ NODE_ENV: 'development' })).cookieSecure).toBe(false);
  });

  it('accepts explicit cookie secure true/false and rejects other text', () => {
    expect(parseIdentityConfig(env({ IDENTITY_COOKIE_SECURE: 'true' })).cookieSecure).toBe(true);
    expect(parseIdentityConfig(env({ IDENTITY_COOKIE_SECURE: 'false' })).cookieSecure).toBe(false);
    expect(() => parseIdentityConfig(env({ IDENTITY_COOKIE_SECURE: 'yes' }))).toThrow();
  });
});
