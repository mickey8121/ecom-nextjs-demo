import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeJwt } from '@/test/jwt';
import { FakeCookies } from '@/test/next-headers';

import {
  deleteSessionCookies,
  readSessionCookies,
  sessionCookieOptions,
  writeSessionCookies,
} from './cookies';

const NOW_SECONDS = 1_800_000_000;
const accessToken = makeJwt({ id: 1, exp: NOW_SECONDS + 60 });
const refreshToken = makeJwt({ id: 1, exp: NOW_SECONDS + 30 * 24 * 3600 });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_SECONDS * 1000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('readSessionCookies', () => {
  it('returns null without a refresh cookie', () => {
    expect(readSessionCookies(new FakeCookies())).toBeNull();
    expect(
      readSessionCookies(new FakeCookies({ ecom_access: accessToken })),
    ).toBeNull();
  });

  it('returns a session without an access token once its cookie has expired', () => {
    const jar = new FakeCookies({ ecom_refresh: refreshToken });

    expect(readSessionCookies(jar)).toEqual({
      accessToken: null,
      refreshToken,
    });
  });

  it('returns both tokens', () => {
    const jar = new FakeCookies({
      ecom_access: accessToken,
      ecom_refresh: refreshToken,
    });

    expect(readSessionCookies(jar)).toEqual({ accessToken, refreshToken });
  });
});

describe('sessionCookieOptions', () => {
  it('sets httpOnly, lax, root path and maxAge until the token expires', () => {
    expect(sessionCookieOptions(accessToken)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
      maxAge: 60,
    });
    expect(sessionCookieOptions(refreshToken).maxAge).toBe(30 * 24 * 3600);
  });

  it('is secure in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(sessionCookieOptions(accessToken).secure).toBe(true);
  });

  it('never sets a negative maxAge', () => {
    const expired = makeJwt({ exp: NOW_SECONDS - 5 });

    expect(sessionCookieOptions(expired).maxAge).toBe(0);
  });

  it('falls back to a browser-session cookie when exp is unknown', () => {
    expect(sessionCookieOptions('garbage')).not.toHaveProperty('maxAge');
  });
});

describe('writing and deleting', () => {
  it('writes both cookies with their own maxAge', () => {
    const jar = new FakeCookies();

    writeSessionCookies(jar, { accessToken, refreshToken });

    expect(jar.writes).toEqual([
      {
        name: 'ecom_access',
        value: accessToken,
        options: sessionCookieOptions(accessToken),
      },
      {
        name: 'ecom_refresh',
        value: refreshToken,
        options: sessionCookieOptions(refreshToken),
      },
    ]);
  });

  it('deletes both cookies', () => {
    const jar = new FakeCookies({
      ecom_access: accessToken,
      ecom_refresh: refreshToken,
    });

    deleteSessionCookies(jar);

    expect(jar.deletions).toEqual(['ecom_access', 'ecom_refresh']);
    expect(readSessionCookies(jar)).toBeNull();
  });
});
