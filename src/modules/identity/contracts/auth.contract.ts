import { z } from 'zod';

export const requestOtpBodySchema = z.object({
  phone: z.string().min(1).max(64),
}).strict();

export const verifyOtpBodySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^[0-9]{6}$/),
}).strict();

export type AuthErrorCode =
  | 'INVALID_PHONE'
  | 'INVALID_AUTH_REQUEST'
  | 'INVALID_OTP_CHALLENGE'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'OTP_NOT_ACTIVE'
  | 'OTP_REQUEST_THROTTLED'
  | 'OTP_ATTEMPTS_EXHAUSTED';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface CurrentUser {
  id: string;
  phoneE164: string;
}
