import 'server-only';

import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { cache } from 'react';

import { SESSION_COOKIES } from '@/shared/config';

import {
  deleteSessionCookies,
  readSessionCookies,
  writeSessionCookies,
} from './cookies';
import { createSessionStore, type SessionStore, type TokenPair } from './store';

export async function createRouteHandlerSessionStore(): Promise<SessionStore> {
  const jar = await cookies();

  return createSessionStore(readSessionCookies(jar), {
    write: (tokens) => writeSessionCookies(jar, tokens),
    erase: () => deleteSessionCookies(jar),
  });
}

// Server Components cannot set cookies: a refreshed pair lives only for the rest of the render.
export const getServerComponentSessionStore = cache(
  async (): Promise<SessionStore> =>
    createSessionStore(readSessionCookies(await cookies())),
);

export type ProxySessionStore = SessionStore & {
  applyTo<R extends NextResponse>(response: R): R;
};

export function createProxySessionStore(
  request: NextRequest,
): ProxySessionStore {
  let pending: { tokens: TokenPair } | 'cleared' | null = null;

  const store = createSessionStore(readSessionCookies(request.cookies), {
    write(tokens) {
      request.cookies.set(SESSION_COOKIES.access, tokens.accessToken);
      request.cookies.set(SESSION_COOKIES.refresh, tokens.refreshToken);
      pending = { tokens };
    },
    erase() {
      request.cookies.delete([SESSION_COOKIES.access, SESSION_COOKIES.refresh]);
      pending = 'cleared';
    },
  });

  return {
    ...store,
    applyTo(response) {
      if (pending === 'cleared') deleteSessionCookies(response.cookies);
      else if (pending) writeSessionCookies(response.cookies, pending.tokens);
      return response;
    },
  };
}
