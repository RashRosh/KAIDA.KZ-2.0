import { describe, expect, it } from 'vitest';
import { createOtpDigest, generateOtp, verifyOtpDigest } from '../../src/modules/identity/crypto/otp';
import { digestSessionToken, generateSessionToken } from '../../src/modules/identity/crypto/session-token';

const SECRET = Buffer.from('11'.repeat(32), 'hex');
const CHALLENGE = '10000000-0000-4000-8000-000000000001';
const PHONE = '+77001234567';

describe('Identity crypto', () => {
  it('formats OTP as exactly six digits including leading zero', () => {
    expect(generateOtp(() => 4281)).toBe('004281');
    expect(generateOtp(() => 999999)).toBe('999999');
  });

  it('domain-separates OTP HMAC by code, challenge and phone', () => {
    const digest = createOtpDigest(SECRET, CHALLENGE, PHONE, '482193');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(createOtpDigest(SECRET, CHALLENGE, PHONE, '482193')).toBe(digest);
    expect(createOtpDigest(SECRET, CHALLENGE, PHONE, '482194')).not.toBe(digest);
    expect(createOtpDigest(SECRET, '20000000-0000-4000-8000-000000000001', PHONE, '482193')).not.toBe(digest);
    expect(createOtpDigest(SECRET, CHALLENGE, '+77001234568', '482193')).not.toBe(digest);
    expect(digest).not.toContain('482193');
  });

  it('verifies OTP digest timing-safe path and rejects wrong/malformed digest', () => {
    const digest = createOtpDigest(SECRET, CHALLENGE, PHONE, '482193');
    expect(verifyOtpDigest(SECRET, CHALLENGE, PHONE, '482193', digest)).toBe(true);
    expect(verifyOtpDigest(SECRET, CHALLENGE, PHONE, '000000', digest)).toBe(false);
    expect(verifyOtpDigest(SECRET, CHALLENGE, PHONE, '482193', 'broken')).toBe(false);
  });

  it('creates a 32-byte base64url session token and SHA-256 digest', () => {
    const bytes = Buffer.alloc(32, 7);
    const token = generateSessionToken((size) => {
      expect(size).toBe(32);
      return bytes;
    });
    expect(Buffer.from(token, 'base64url')).toEqual(bytes);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(digestSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(digestSessionToken(token)).toBe(digestSessionToken(token));
    expect(digestSessionToken(`${token}x`)).not.toBe(digestSessionToken(token));
  });
});
