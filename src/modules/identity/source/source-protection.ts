import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { AuthError } from '../contracts/auth.contract';

export type SourceProtection = { secret: Buffer; generation: string };
export type SourceAdmission = { digest: string; generation: string };
export const SOURCE_WINDOW_MS = 900_000;
export const SOURCE_LIMIT = 20;
export const SOURCE_CLEANUP_INTERVAL_MS = 300_000;
export const SOURCE_RETENTION_MS = 86_400_000;

export function sourceUnavailable(): AuthError {
  return new AuthError('AUTH_UNAVAILABLE', 503, 'Новый код сейчас недоступен. Попробуйте позже.', undefined, true);
}

export function normalizeSourceIp(raw: string | undefined): string {
  if (!raw || raw !== raw.trim() || /[,\s%\[\]]/.test(raw) || !isIP(raw)) throw sourceUnavailable();
  if (isIP(raw) === 4) return raw;
  const canonical = new URL(`http://[${raw}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(canonical);
  if (!mapped) return canonical;
  const hi = parseInt(mapped[1], 16), lo = parseInt(mapped[2], 16);
  return `${hi >>> 8}.${hi & 255}.${lo >>> 8}.${lo & 255}`;
}

export function loadSourceProtection(env: Record<string, string | undefined> = process.env): SourceProtection | false {
  const mode = env.IDENTITY_OTP_SOURCE_PROTECTION ?? 'off';
  if (mode === 'off') return false;
  if (mode !== 'trusted-proxy' || env.IDENTITY_OTP_SOURCE_INGRESS !== 'isolated-proxy' ||
      !/^[0-9a-fA-F]{64}$/.test(env.IDENTITY_OTP_SOURCE_HMAC_SECRET_HEX ?? '') ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(env.IDENTITY_OTP_SOURCE_KEY_GENERATION ?? '')) throw sourceUnavailable();
  const secret = Buffer.from(env.IDENTITY_OTP_SOURCE_HMAC_SECRET_HEX!, 'hex');
  // The generation is nonsecret, but also detects an accidentally mismatched key under the same configured epoch.
  const generation = createHmac('sha256', secret).update(`kaida-source-generation-v1\0${env.IDENTITY_OTP_SOURCE_KEY_GENERATION}`).digest('hex');
  return { secret, generation };
}

export function sourceAdmission(config: SourceProtection, raw: string | undefined): SourceAdmission {
  const ip = normalizeSourceIp(raw);
  return { generation: config.generation, digest: createHmac('sha256', config.secret).update(`kaida-source-v1\0${ip}`).digest('hex') };
}

export function sourceRetrySeconds(times: Date[], now: Date): number {
  const active = times.map(t => t.getTime()).filter(t => t > now.getTime() - SOURCE_WINDOW_MS).sort((a, b) => a - b);
  return active.length < SOURCE_LIMIT ? 0 : Math.max(0, Math.ceil((active[active.length - SOURCE_LIMIT] + SOURCE_WINDOW_MS - now.getTime()) / 1000));
}
