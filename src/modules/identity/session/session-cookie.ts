export const SESSION_COOKIE_NAME = 'kaida_session';

export interface SessionCookieSpec {
  name: typeof SESSION_COOKIE_NAME;
  value: string;
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  secure: boolean;
  expires: Date;
  maxAge: number;
}

export function buildSessionCookie(token: string, expiresAt: Date, sessionTtlSeconds: number, secure: boolean): SessionCookieSpec {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    expires: expiresAt,
    maxAge: sessionTtlSeconds,
  };
}

export function buildLogoutCookie(secure: boolean): SessionCookieSpec {
  return {
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    expires: new Date(0),
    maxAge: 0,
  };
}
