export interface IdentityEnvironment {
  [key: string]: string | undefined;
  IDENTITY_OTP_TTL_SECONDS?: string;
  IDENTITY_SESSION_TTL_SECONDS?: string;
  IDENTITY_OTP_HMAC_SECRET_HEX?: string;
  IDENTITY_COOKIE_SECURE?: string;
  NODE_ENV?: string;
}

export interface IdentityConfig {
  otpTtlSeconds: number;
  sessionTtlSeconds: number;
  otpHmacSecret: Buffer;
  cookieSecure: boolean;
}

function positiveSafeInteger(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === '') return fallback;
  if (!/^[0-9]+$/.test(raw)) throw new Error(`${name} must be a positive safe integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive safe integer`);
  return value;
}

function cookieSecure(raw: string | undefined, nodeEnv: string | undefined): boolean {
  if (raw === undefined || raw === '') return nodeEnv === 'production';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error('IDENTITY_COOKIE_SECURE must be true or false');
}

export function parseIdentityConfig(environment: IdentityEnvironment): IdentityConfig {
  const secretHex = environment.IDENTITY_OTP_HMAC_SECRET_HEX;
  if (!secretHex || !/^[0-9a-fA-F]{64}$/.test(secretHex)) {
    throw new Error('IDENTITY_OTP_HMAC_SECRET_HEX must be exactly 32 random bytes encoded as 64 hex characters');
  }

  return {
    otpTtlSeconds: positiveSafeInteger(environment.IDENTITY_OTP_TTL_SECONDS, 300, 'IDENTITY_OTP_TTL_SECONDS'),
    sessionTtlSeconds: positiveSafeInteger(environment.IDENTITY_SESSION_TTL_SECONDS, 2_592_000, 'IDENTITY_SESSION_TTL_SECONDS'),
    otpHmacSecret: Buffer.from(secretHex, 'hex'),
    cookieSecure: cookieSecure(environment.IDENTITY_COOKIE_SECURE, environment.NODE_ENV),
  };
}

export function loadIdentityConfig(): IdentityConfig {
  return parseIdentityConfig(process.env);
}
