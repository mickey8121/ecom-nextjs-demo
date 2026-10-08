import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeJwt } from '@/test/jwt';
import { FakeCookies, mockCookies } from '@/test/next-headers';

import {
  createProxySessionStore,
  createRouteHandlerSessionStore,
  getServerComponentSessionStore,
} from './adapters';
import { sessionCookieOptions } from './cookies';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const NOW_SECONDS = 1_800_000_000;
const oldPair = {
  accessToken: makeJwt({ id: 1, exp: NOW_SECONDS + 5 }),
  refreshToken: makeJwt({ id: 1, exp: NOW_SECONDS + 3600 }),
};
const newPair = {
  accessToken: makeJwt({ id: 1, exp: NOW_SECONDS + 60 }),
  refreshToken: makeJwt({ id: 1, exp: NOW_SECONDS + 7200 }),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_SECONDS * 1000);
});

afterEach(() => {
  vi.useRealTimers();
});

function sessionJar() {
  return new FakeCookies({
    ecom_access: oldPair.accessToken,
    ecom_refresh: oldPair.refreshToken,
  });
}

describe('route handler store', () => {
  it('reads the session from cookies()', async () => {
    mockCookies(sessionJar());

    const store = await createRouteHandlerSessionStore();

    expect(store.get()).toEqual(oldPair);
  });

  it('writes a new pair to the response cookies', async () => {
    const jar = sessionJar();
    mockCookies(jar);
    const store = await createRouteHandlerSessionStore();

    store.set(newPair);

    expect(store.get()).toEqual(newPair);
    expect(jar.writes).toEqual([
      {
        name: 'ecom_access',
        value: newPair.accessToken,
        options: sessionCookieOptions(newPair.accessToken),
      },
      {
        name: 'ecom_refresh',
        value: newPair.refreshToken,
        options: sessionCookieOptions(newPair.refreshToken),
      },
    ]);
  });

  it('deletes both cookies on clear', async () => {
    const jar = sessionJar();
    mockCookies(jar);
    const store = await createRouteHandlerSessionStore();

    store.clear();

    expect(store.get()).toBeNull();
    expect(jar.deletions).toEqual(['ecom_access', 'ecom_refresh']);
  });
});

describe('Server Component store', () => {
  it('keeps writes in memory for later reads and never writes cookies', async () => {
    const jar = sessionJar();
    mockCookies(jar);
    const store = await getServerComponentSessionStore();

    store.set(newPair);
    expect(store.get()).toEqual(newPair);

    store.clear();
    expect(store.get()).toBeNull();

    expect(jar.writes).toEqual([]);
    expect(jar.deletions).toEqual([]);
  });
});

describe('proxy store', () => {
  function proxyRequest() {
    return new NextRequest('http://localhost/dashboard', {
      headers: {
        cookie: `ecom_access=${oldPair.accessToken}; ecom_refresh=${oldPair.refreshToken}; theme=dark`,
      },
    });
  }

  it('reads the session from the request cookies', () => {
    expect(createProxySessionStore(proxyRequest()).get()).toEqual(oldPair);
  });

  it('forwards a new pair in the request Cookie header and sets it on the response', () => {
    const request = proxyRequest();
    const store = createProxySessionStore(request);

    store.set(newPair);
    const response = store.applyTo(
      NextResponse.next({ request: { headers: request.headers } }),
    );

    expect(request.cookies.get('ecom_access')?.value).toBe(newPair.accessToken);
    expect(request.cookies.get('ecom_refresh')?.value).toBe(
      newPair.refreshToken,
    );
    expect(request.cookies.get('theme')?.value).toBe('dark');
    expect(response.headers.get('x-middleware-request-cookie')).toContain(
      newPair.accessToken,
    );

    const access = response.cookies.get('ecom_access');
    expect(access).toMatchObject({
      value: newPair.accessToken,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60,
    });
    expect(response.cookies.get('ecom_refresh')?.value).toBe(
      newPair.refreshToken,
    );
  });

  it('removes the session from the forwarded request and the browser on clear', () => {
    const request = proxyRequest();
    const store = createProxySessionStore(request);

    store.clear();
    const response = store.applyTo(
      NextResponse.redirect('http://localhost/login'),
    );

    expect(request.cookies.has('ecom_access')).toBe(false);
    expect(request.cookies.has('ecom_refresh')).toBe(false);
    expect(request.cookies.get('theme')?.value).toBe('dark');
    const setCookie = response.headers.getSetCookie();
    expect(setCookie).toHaveLength(2);
    expect(
      setCookie.every((cookie) => cookie.includes('Expires=Thu, 01 Jan 1970')),
    ).toBe(true);
  });

  it('leaves the response untouched when the session did not change', () => {
    const store = createProxySessionStore(proxyRequest());

    const response = store.applyTo(NextResponse.next());

    expect(response.headers.getSetCookie()).toEqual([]);
  });
});
