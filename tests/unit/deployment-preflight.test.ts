import { describe, expect, it } from 'vitest';
import { checkEnvironment, decideBindAddress, hasErrors, TEST_AUTH_NOTICE } from '../../ops/deployment/preflight-rules';

const good = {
  KAIDA_DB_USER: 'kaida_deploy',
  KAIDA_DB_PASSWORD: 'Zx81Qw2Lm9Pr4Tn7Vb3k',
  KAIDA_DB_NAME: 'kaida_deploy',
  KAIDA_PHOTOS_DIR: 'C:/kaida-deploy/photos',
  IDENTITY_OTP_HMAC_SECRET_HEX: 'a'.repeat(64),
  IDENTITY_COOKIE_SECURE: 'true',
  SEARCH_EVENTS_ORIGIN: 'test',
};

describe('R3 deployment preflight: published address', () => {
  it('defaults to loopback', () => {
    expect(decideBindAddress(undefined, undefined)).toEqual({ ok: true, mode: 'loopback' });
    expect(decideBindAddress('', undefined)).toEqual({ ok: true, mode: 'loopback' });
    expect(decideBindAddress('127.0.0.1', undefined)).toEqual({ ok: true, mode: 'loopback' });
  });

  it('allows a private address only with the explicit acknowledgement', () => {
    for (const address of ['192.168.1.20', '10.0.0.5', '172.16.4.9', '172.31.255.1']) {
      expect(decideBindAddress(address, undefined).ok).toBe(false);
      expect(decideBindAddress(address, 'no').ok).toBe(false);
      expect(decideBindAddress(address, 'yes')).toEqual({ ok: true, mode: 'private-test' });
    }
  });

  it('refuses wildcards, public addresses, names and IPv6 even with the acknowledgement', () => {
    for (const address of ['0.0.0.0', '::', '::1', '8.8.8.8', '172.32.0.1', '172.15.0.1', '192.169.1.1', 'localhost', 'example.com', '300.1.1.1', '192.168.01.1', '192.168.1']) {
      expect(decideBindAddress(address, 'yes').ok, address).toBe(false);
    }
  });
});

describe('R3 deployment preflight: environment', () => {
  it('passes a complete configuration and still prints the Test OTP notice', () => {
    const findings = checkEnvironment(good);
    expect(hasErrors(findings)).toBe(false);
    expect(findings.some((finding) => finding.message === TEST_AUTH_NOTICE)).toBe(true);
  });

  it.each([
    ['a missing variable', { ...good, KAIDA_DB_USER: undefined }, 'missing'],
    ['a short secret', { ...good, IDENTITY_OTP_HMAC_SECRET_HEX: 'abcd' }, 'secret-format'],
    ['a non-hex secret', { ...good, IDENTITY_OTP_HMAC_SECRET_HEX: 'z'.repeat(64) }, 'secret-format'],
    ['insecure cookies', { ...good, IDENTITY_COOKIE_SECURE: 'false' }, 'cookie-secure'],
    ['organic recording', { ...good, SEARCH_EVENTS_ORIGIN: 'organic' }, 'organic'],
    ['a development database name', { ...good, KAIDA_DB_NAME: 'kaida' }, 'db-name'],
    ['a placeholder password', { ...good, KAIDA_DB_PASSWORD: 'CHANGE_ME' }, 'db-password'],
    ['a protected port', { ...good, KAIDA_APP_PORT: '3000' }, 'port'],
    ['an invalid database user', { ...good, KAIDA_DB_USER: 'user@host' }, 'db-user'],
    ['a wildcard address', { ...good, KAIDA_BIND_ADDRESS: '0.0.0.0', KAIDA_PRIVATE_TEST_ACK: 'yes' }, 'bind-address'],
  ])('refuses %s', (_name, env, code) => {
    const findings = checkEnvironment(env);
    expect(hasErrors(findings)).toBe(true);
    expect(findings.some((finding) => finding.level === 'error' && finding.code === code)).toBe(true);
  });

  it('never repeats a secret value in a message', () => {
    const findings = checkEnvironment({ ...good, IDENTITY_OTP_HMAC_SECRET_HEX: 'secretsecret', KAIDA_DB_PASSWORD: 'short' });
    for (const finding of findings) {
      expect(finding.message).not.toContain('secretsecret');
      expect(finding.message).not.toContain('short');
    }
  });
});
