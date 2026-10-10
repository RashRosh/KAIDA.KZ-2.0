import { describe, expect, it } from 'vitest';
import { loadSourceProtection, normalizeSourceIp, sourceAdmission, sourceRetrySeconds } from '../../src/modules/identity/source/source-protection';

describe('source identity and policy', () => {
  it('canonicalizes IPv4 mapped and equivalent IPv6 addresses, not subnets', () => {
    expect(normalizeSourceIp('::ffff:192.0.2.10')).toBe('192.0.2.10');
    expect(normalizeSourceIp('::ffff:c000:20a')).toBe('192.0.2.10');
    expect(normalizeSourceIp('2001:0DB8:0:0:0:0:0:1')).toBe('2001:db8::1');
    expect(normalizeSourceIp('2001:db8::2')).not.toBe(normalizeSourceIp('2001:db8::1'));
  });
  it.each(['', '192.0.2.1,192.0.2.2', '192.0.2.1:123', '[::1]', 'fe80::1%eth0', 'localhost', ' 192.0.2.1', '192.000.2.1'])('rejects invalid/header-list source %s before issuance', ip => {
    expect(() => normalizeSourceIp(ip)).toThrow(expect.objectContaining({ status: 503, preservesCurrentCode: true }));
  });
  it('is off by default, requires explicit ingress/key and detects wrong keys', () => {
    expect(loadSourceProtection({})).toBe(false);
    expect(() => loadSourceProtection({ IDENTITY_OTP_SOURCE_PROTECTION: 'trusted-proxy' })).toThrow();
    const env = { IDENTITY_OTP_SOURCE_PROTECTION: 'trusted-proxy', IDENTITY_OTP_SOURCE_INGRESS: 'isolated-proxy', IDENTITY_OTP_SOURCE_HMAC_SECRET_HEX: '22'.repeat(32), IDENTITY_OTP_SOURCE_KEY_GENERATION: 'initial' };
    const a = loadSourceProtection(env), b = loadSourceProtection({ ...env, IDENTITY_OTP_SOURCE_HMAC_SECRET_HEX: '33'.repeat(32) });
    expect(a && b && a.generation !== b.generation).toBe(true);
    if (!a) throw new Error('config');
    expect(sourceAdmission(a, '::ffff:192.0.2.10')).toEqual(sourceAdmission(a, '192.0.2.10'));
    expect(sourceAdmission(a, '192.0.2.10').digest).toMatch(/^[a-f0-9]{64}$/);
  });
  it('has no source cooldown; strict rolling boundary and final-slot wait', () => {
    const now = new Date('2026-10-11T00:00:00Z');
    expect(sourceRetrySeconds([now], now)).toBe(0);
    expect(sourceRetrySeconds(Array(20).fill(now), now)).toBe(900);
    expect(sourceRetrySeconds(Array(20).fill(now), new Date(+now + 900000))).toBe(0);
  });
});
