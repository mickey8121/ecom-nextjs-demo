import 'server-only';

import { SESSION_COOKIES } from '@/shared/config';

import { readTokenExpiry } from './jwt';
import type { SessionTokens, TokenPair } from './store';

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  secure: boolean;
  maxAge?: number;
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

type CookieWriter = {
  set(name: string, value: string, options: SessionCookieOptions): unknown;
  delete(name: string): unknown;
};

export function readSessionCookies(jar: CookieReader): SessionTokens | null {
  const refreshToken = jar.get(SESSION_COOKIES.refresh)?.value;
  if (!refreshToken) return null;

  return {
    accessToken: jar.get(SESSION_COOKIES.access)?.value || null,
    refreshToken,
  };
}

export function writeSessionCookies(jar: CookieWriter, tokens: TokenPair) {
  jar.set(
    SESSION_COOKIES.access,
    tokens.accessToken,
    sessionCookieOptions(tokens.accessToken),
  );
  jar.set(
    SESSION_COOKIES.refresh,
    tokens.refreshToken,
    sessionCookieOptions(tokens.refreshToken),
  );
}

export function deleteSessionCookies(jar: CookieWriter) {
  jar.delete(SESSION_COOKIES.access);
  jar.delete(SESSION_COOKIES.refresh);
}

export function sessionCookieOptions(token: string): SessionCookieOptions {
  const options: SessionCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  };

  const expiry = readTokenExpiry(token);
  if (expiry !== null) {
    options.maxAge = Math.max(0, expiry - Math.floor(Date.now() / 1000));
  }
  return options;
}
