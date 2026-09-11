import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export function generateOtp(randomInteger: (maxExclusive: number) => number = (max) => randomInt(max)): string {
  return randomInteger(1_000_000).toString().padStart(6, '0');
}

function otpMessage(challengeId: string, phoneE164: string, otp: string): string {
  return `kaida-otp-v1\0${challengeId}\0${phoneE164}\0${otp}`;
}

export function createOtpDigest(secret: Buffer, challengeId: string, phoneE164: string, otp: string): string {
  return createHmac('sha256', secret).update(otpMessage(challengeId, phoneE164, otp), 'utf8').digest('hex');
}

export function verifyOtpDigest(
  secret: Buffer,
  challengeId: string,
  phoneE164: string,
  otp: string,
  expectedDigest: string,
): boolean {
  if (!/^[0-9a-f]{64}$/.test(expectedDigest)) return false;
  const actual = Buffer.from(createOtpDigest(secret, challengeId, phoneE164, otp), 'hex');
  const expected = Buffer.from(expectedDigest, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
