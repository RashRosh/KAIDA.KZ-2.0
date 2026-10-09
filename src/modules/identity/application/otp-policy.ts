import type { IdentityConfig } from '../config/identity.config';

export function otpPolicy(config: IdentityConfig) {
  return {
    intervalSeconds: config.otpRequestIntervalSeconds ?? 60,
    windowSeconds: config.otpRequestWindowSeconds ?? 900,
    requestLimit: config.otpRequestLimit ?? 5,
    maxFailures: config.otpMaxFailedAttempts ?? 5,
  };
}

export type OtpPolicy = ReturnType<typeof otpPolicy>;

/** Accepted requests only. A denied request never moves either boundary. */
export function requestRetryAfterSeconds(created: Date[], now: Date, policy: OtpPolicy): number {
  const times = created.map((date) => date.getTime()).sort((a, b) => a - b);
  const recent = times.filter((time) => time > now.getTime() - policy.windowSeconds * 1000);
  const intervalEnd = times.length ? times[times.length - 1] + policy.intervalSeconds * 1000 : 0;
  const windowEnd = recent.length >= policy.requestLimit
    ? recent[recent.length - policy.requestLimit] + policy.windowSeconds * 1000 : 0;
  return Math.max(0, Math.ceil((Math.max(intervalEnd, windowEnd) - now.getTime()) / 1000));
}
