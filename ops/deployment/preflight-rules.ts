// R3 (docs/slices/r3-deployment-preparation): pure rules of the deployment preflight. No I/O, no secrets in any message.
// Used by `pnpm deploy:up` (host, offline rules) and `pnpm deploy:preflight` (tools container, adds the online checks).

export type Finding = { level: 'error' | 'warn' | 'info'; code: string; message: string };
export type Environment = Readonly<Record<string, string | undefined>>;

export const TEST_AUTH_NOTICE =
  'Test OTP is active: the login code is returned to the client. Any instance reachable from a network lets anyone log in as any phone. '
  + 'Do not expose this stack publicly; real authentication is a separate decision (O-AUTH).';

const DEVELOPMENT_DATABASES = ['kaida', 'kaida_test'];

// Published ports are loopback by default. A private-network address is accepted only with an explicit acknowledgement
// (private testing). Everything else - 0.0.0.0, ::, public addresses, host names, IPv6 - is refused without exception.
export type BindDecision = { ok: true; mode: 'loopback' | 'private-test' } | { ok: false; reason: string };

function ipv4(value: string): number[] | undefined {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (!match) return undefined;
  const parts = match.slice(1);
  if (parts.some((part) => Number(part) > 255 || (part.length > 1 && part.startsWith('0')))) return undefined;
  return parts.map(Number);
}

export function decideBindAddress(address: string | undefined, acknowledgement: string | undefined): BindDecision {
  const value = (address ?? '').trim();
  if (value === '') return { ok: true, mode: 'loopback' };
  const octets = ipv4(value);
  if (!octets) return { ok: false, reason: 'KAIDA_BIND_ADDRESS must be an IPv4 address (host names, IPv6 and wildcards are refused).' };
  const [a, b] = octets;
  if (a === 127) return { ok: true, mode: 'loopback' };
  if (a === 0) return { ok: false, reason: 'KAIDA_BIND_ADDRESS 0.0.0.0 would publish the stack on every interface and is refused.' };
  const isPrivate = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  if (!isPrivate) return { ok: false, reason: 'KAIDA_BIND_ADDRESS is not a loopback or private-network address and is refused.' };
  if (acknowledgement !== 'yes') {
    return { ok: false, reason: 'A private-network address needs KAIDA_PRIVATE_TEST_ACK=yes (private testing only: the stack uses Test OTP).' };
  }
  return { ok: true, mode: 'private-test' };
}

export function checkEnvironment(env: Environment): Finding[] {
  const findings: Finding[] = [];
  const add = (level: Finding['level'], code: string, message: string) => findings.push({ level, code, message });

  for (const name of ['KAIDA_DB_USER', 'KAIDA_DB_PASSWORD', 'KAIDA_DB_NAME', 'IDENTITY_OTP_HMAC_SECRET_HEX']) {
    if (!env[name]) add('error', 'missing', `${name} is required.`);
  }
  const secret = env.IDENTITY_OTP_HMAC_SECRET_HEX;
  if (secret && !/^[0-9a-fA-F]{64}$/.test(secret)) add('error', 'secret-format', 'IDENTITY_OTP_HMAC_SECRET_HEX must be 64 hexadecimal characters.');
  const password = env.KAIDA_DB_PASSWORD;
  if (password && !/^[A-Za-z0-9]{16,}$/.test(password)) add('error', 'db-password', 'KAIDA_DB_PASSWORD must be at least 16 letters or digits (it is used inside a connection URL).');
  const database = env.KAIDA_DB_NAME;
  if (database && DEVELOPMENT_DATABASES.includes(database)) add('error', 'db-name', `KAIDA_DB_NAME must not be a development database (${DEVELOPMENT_DATABASES.join(', ')}).`);
  if (database && !/^[a-z][a-z0-9_]{2,62}$/.test(database)) add('error', 'db-name-format', 'KAIDA_DB_NAME must be lowercase letters, digits and underscores.');
  if (env.IDENTITY_COOKIE_SECURE !== 'true') add('error', 'cookie-secure', 'IDENTITY_COOKIE_SECURE must be true (the stack is served over HTTPS).');
  if (env.SEARCH_EVENTS_ORIGIN === 'organic') add('error', 'organic', 'SEARCH_EVENTS_ORIGIN=organic is blocked: the daily purge must be scheduled and verified first (O-D0-ORG, outside R3).');
  if (env.KAIDA_DB_USER && !/^[a-z][a-z0-9_]{2,62}$/.test(env.KAIDA_DB_USER)) add('error', 'db-user', 'KAIDA_DB_USER must be lowercase letters, digits and underscores.');
  for (const name of ['KAIDA_APP_PORT', 'KAIDA_TLS_PORT']) {
    const port = env[name];
    if (port && (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535 || [3000, 3100, 3101, 5432].includes(Number(port)))) {
      add('error', 'port', `${name} must be an unprivileged port, outside the protected development ports.`);
    }
  }

  const bind = decideBindAddress(env.KAIDA_BIND_ADDRESS, env.KAIDA_PRIVATE_TEST_ACK);
  if (!bind.ok) add('error', 'bind-address', bind.reason);
  else if (bind.mode === 'private-test') add('warn', 'private-test', 'Published on a private-network address: private testing only (Test OTP).');

  add('warn', 'test-auth', TEST_AUTH_NOTICE);
  return findings;
}

export function hasErrors(findings: readonly Finding[]): boolean {
  return findings.some((finding) => finding.level === 'error');
}

export function formatFinding(finding: Finding): string {
  return `${finding.level.toUpperCase().padEnd(5)} ${finding.code}: ${finding.message}`;
}

// Rules over the variables the application container itself sees (the tools container runs the online preflight with them).
export function checkRuntimeEnvironment(env: Environment): Finding[] {
  const findings: Finding[] = [];
  const add = (level: Finding['level'], code: string, message: string) => findings.push({ level, code, message });
  const url = env.DATABASE_URL;
  if (!url) add('error', 'missing', 'DATABASE_URL is required.');
  else {
    try {
      const parsed = new URL(url);
      const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
      const local = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
      if (DEVELOPMENT_DATABASES.includes(database) || (local && (parsed.port || '5432') === '5432')) {
        add('error', 'dev-stack', 'DATABASE_URL points at the development stack (port 5432 on this host or a development database).');
      }
    } catch {
      add('error', 'database-url', 'DATABASE_URL is not a valid URL.');
    }
  }
  if (!/^[0-9a-fA-F]{64}$/.test(env.IDENTITY_OTP_HMAC_SECRET_HEX ?? '')) add('error', 'secret-format', 'IDENTITY_OTP_HMAC_SECRET_HEX must be 64 hexadecimal characters.');
  if (env.IDENTITY_COOKIE_SECURE !== 'true') add('error', 'cookie-secure', 'IDENTITY_COOKIE_SECURE must be true.');
  if (env.SEARCH_EVENTS_ORIGIN === 'organic') add('error', 'organic', 'SEARCH_EVENTS_ORIGIN=organic is blocked (O-D0-ORG, outside R3).');
  if (!env.PHOTO_STORAGE_DIR) add('error', 'missing', 'PHOTO_STORAGE_DIR is required.');
  const bind = decideBindAddress(env.KAIDA_BIND_ADDRESS, env.KAIDA_PRIVATE_TEST_ACK);
  if (!bind.ok) add('error', 'bind-address', bind.reason);
  add('warn', 'test-auth', TEST_AUTH_NOTICE);
  return findings;
}
