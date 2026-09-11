import { describe, expect, it } from 'vitest';
import { buildLogoutCookie, buildSessionCookie, SESSION_COOKIE_NAME } from '../../src/modules/identity/session/session-cookie';

describe('Identity session cookie', () => {
  it('sets stable persistent cookie attributes including Expires and Max-Age', () => {
    const expiresAt = new Date('2026-10-11T12:00:00.000Z');
    expect(buildSessionCookie('opaque', expiresAt, 2_592_000, true)).toEqual({
      name: SESSION_COOKIE_NAME,
      value: 'opaque',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
      expires: expiresAt,
      maxAge: 2_592_000,
    });
    expect(SESSION_COOKIE_NAME).toBe('kaida_session');
  });

  it('removes exactly the same cookie scope with Max-Age zero and expired Expires', () => {
    const cookie = buildLogoutCookie(false);
    expect(cookie).toMatchObject({
      name: 'kaida_session',
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
      maxAge: 0,
    });
    expect(cookie.expires.getTime()).toBeLessThan(Date.now());
  });
});
