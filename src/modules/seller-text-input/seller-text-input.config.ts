export const sellerTextInputModes = ['off', 'fake', 'real'] as const;

export type SellerTextInputMode = typeof sellerTextInputModes[number];

export type SellerTextInputEnvironment = Readonly<Record<string, string | undefined>>;

export const PARSER_TIMEOUT_DEFAULT_MS = 60_000;
export const PARSER_TIMEOUT_MAX_MS = 180_000;
export const PARSER_API_KEY_MIN_LENGTH = 32;

export type RealParserConfig = {
  url: URL;
  apiKey: string | null;
  timeoutMs: number;
  concurrency: number;
  allowlist: ReadonlySet<string>;
};

const reported = new Set<string>();

function reportOnce(message: string) {
  if (reported.has(message)) return;
  reported.add(message);
  console.error(message);
}

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
}

function intSetting(raw: string | undefined, fallback: number, min: number, max: number): number | null {
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return value >= min && value <= max ? value : null;
}

// seller-ai-text-real-parser §8. A `real` configuration that breaks a rule is invalid: the caller degrades to `off`.
// The returned reason names the rule, never a value (the URL and the key are deployment secrets).
export function readRealParserConfig(env: SellerTextInputEnvironment = process.env): RealParserConfig | { invalid: string } {
  let url: URL;
  try {
    url = new URL(env.SELLER_TEXT_PARSER_URL ?? '');
  } catch {
    return { invalid: 'SELLER_TEXT_PARSER_URL must be an absolute http(s) URL' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { invalid: 'SELLER_TEXT_PARSER_URL must use http or https' };
  if (url.username || url.password) return { invalid: 'SELLER_TEXT_PARSER_URL must not contain credentials' };
  const loopback = isLoopbackHost(url.hostname);
  if (!loopback && url.protocol !== 'https:') return { invalid: 'a non-loopback SELLER_TEXT_PARSER_URL must use https' };
  const apiKey = env.SELLER_TEXT_PARSER_API_KEY ? env.SELLER_TEXT_PARSER_API_KEY : null;
  if (apiKey !== null && apiKey.length < PARSER_API_KEY_MIN_LENGTH) {
    return { invalid: `SELLER_TEXT_PARSER_API_KEY must have at least ${PARSER_API_KEY_MIN_LENGTH} characters` };
  }
  if (!loopback && apiKey === null) return { invalid: 'SELLER_TEXT_PARSER_API_KEY is required for a non-loopback SELLER_TEXT_PARSER_URL' };
  const timeoutMs = intSetting(env.SELLER_TEXT_PARSER_TIMEOUT_MS, PARSER_TIMEOUT_DEFAULT_MS, 1_000, PARSER_TIMEOUT_MAX_MS);
  if (timeoutMs === null) return { invalid: `SELLER_TEXT_PARSER_TIMEOUT_MS must be 1000–${PARSER_TIMEOUT_MAX_MS}` };
  const concurrency = intSetting(env.SELLER_TEXT_PARSER_CONCURRENCY, 1, 1, 8);
  if (concurrency === null) return { invalid: 'SELLER_TEXT_PARSER_CONCURRENCY must be 1–8' };
  const allowlist = new Set((env.SELLER_TEXT_INPUT_ALLOWLIST ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  return { url, apiKey, timeoutMs, concurrency, allowlist };
}

// `off` is default (PROJECT_RULES §10.1). `fake` is a deterministic network-free parser for tests and local demos.
// `real` calls the configured inference service; an invalid `real` configuration is `off` with one log line.
export function readSellerTextInputMode(
  env: SellerTextInputEnvironment = process.env,
): SellerTextInputMode {
  const raw = env.SELLER_TEXT_INPUT;
  if (raw === undefined || raw === '') return 'off';
  if (!(sellerTextInputModes as readonly string[]).includes(raw)) {
    reportOnce('SELLER_TEXT_INPUT must be one of: off, fake, real; text input stays off');
    return 'off';
  }
  if (raw === 'real') {
    const config = readRealParserConfig(env);
    if ('invalid' in config) {
      reportOnce(`Seller text parser configuration is invalid (${config.invalid}); text input stays off`);
      return 'off';
    }
  }
  return raw as SellerTextInputMode;
}

export type TextInputUser = { id: string; phoneE164: string };

// In `real` mode only allowlisted users (user ID or login phone in E.164) see and use the channel (§8).
export function isSellerTextInputEnabledFor(
  user: TextInputUser | null,
  env: SellerTextInputEnvironment = process.env,
): boolean {
  const mode = readSellerTextInputMode(env);
  if (mode === 'off') return false;
  if (mode === 'fake') return true;
  if (!user) return false;
  const config = readRealParserConfig(env);
  return !('invalid' in config) && (config.allowlist.has(user.id) || config.allowlist.has(user.phoneE164));
}
