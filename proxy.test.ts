import { NextRequest, type NextResponse } from 'next/server';
import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from 'next/experimental/testing/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeJwt } from '@/test/jwt';

import { config, proxy } from './proxy';

const fetchMock = vi.fn<typeof fetch>();
const consoleError = vi.spyOn(console, 'error');

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  consoleError.mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  consoleError.mockReset();
});

const nowSeconds = () => Math.floor(Date.now() / 1000);
const freshAccess = () => makeJwt({ id: 1, exp: nowSeconds() + 60 });
const expiringAccess = () => makeJwt({ id: 1, exp: nowSeconds() + 5 });
const refreshToken = makeJwt({ id: 1, exp: nowSeconds() + 3600 });
const newPair = {
  accessToken: makeJwt({ id: 1, exp: nowSeconds() + 60, fresh: true }),
  refreshToken: makeJwt({ id: 1, exp: nowSeconds() + 7200 }),
};

function request(path: string, cookies: Record<string, string> = {}) {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  return new NextRequest(new URL(path, 'http://localhost'), {
    headers: cookie ? { cookie } : {},
  });
}

const withSession = (accessToken: string | null = freshAccess()) => ({
  ...(accessToken ? { ecom_access: accessToken } : {}),
  ecom_refresh: refreshToken,
});

function redirectPath(response: NextResponse) {
  const url = getRedirectUrl(response);
  return url ? new URL(url).pathname : null;
}

const forwardedCookie = (response: NextResponse) =>
  response.headers.get('x-middleware-request-cookie') ?? '';

const refreshCalls = () =>
  fetchMock.mock.calls.filter(
    ([input]) => new URL(String(input)).pathname === '/auth/refresh',
  );

describe('matcher', () => {
  it.each([
    '/',
    '/login',
    '/login?session=expired',
    '/dashboard',
    '/dashboard/x',
  ])('runs on %s', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it.each([
    '/api/products',
    '/api/auth/login',
    '/_next/static/chunks/main.js',
    '/_next/image?url=%2Fa.png&w=64&q=75',
    '/favicon.ico',
  ])('does not run on %s', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});

describe('access matrix', () => {
  it('sends / to /login without a session', async () => {
    expect(redirectPath(await proxy(request('/')))).toBe('/login');
  });

  it('sends / to /dashboard with a session', async () => {
    expect(redirectPath(await proxy(request('/', withSession())))).toBe(
      '/dashboard',
    );
  });

  it('shows /login without a session', async () => {
    expect(redirectPath(await proxy(request('/login')))).toBeNull();
  });

  it('sends /login to /dashboard with a session', async () => {
    expect(redirectPath(await proxy(request('/login', withSession())))).toBe(
      '/dashboard',
    );
  });

  it('clears the session on /login?session=expired and shows the login page', async () => {
    const response = await proxy(
      request('/login?session=expired', { ...withSession(), theme: 'dark' }),
    );

    expect(redirectPath(response)).toBeNull();
    const cleared = response.headers.getSetCookie();
    expect(cleared).toHaveLength(2);
    expect(cleared.join()).toContain('ecom_access=;');
    expect(cleared.join()).toContain('ecom_refresh=;');
    expect(forwardedCookie(response)).toBe('theme=dark');
  });

  it.each(['/dashboard', '/dashboard/x'])(
    'sends %s to /login without a session',
    async (path) => {
      expect(redirectPath(await proxy(request(path)))).toBe('/login');
    },
  );

  it('lets /dashboard through with a fresh token and no upstream call', async () => {
    const response = await proxy(request('/dashboard', withSession()));

    expect(redirectPath(response)).toBeNull();
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('proactive refresh', () => {
  it.each([
    ['expires within the leeway', expiringAccess()],
    ['is missing', null],
  ])('refreshes once when the access token %s', async (_case, accessToken) => {
    fetchMock.mockResolvedValue(Response.json(newPair));

    const response = await proxy(
      request('/dashboard', withSession(accessToken)),
    );

    expect(refreshCalls()).toHaveLength(1);
    expect(redirectPath(response)).toBeNull();
    expect(response.cookies.get('ecom_access')?.value).toBe(
      newPair.accessToken,
    );
    expect(response.cookies.get('ecom_refresh')?.value).toBe(
      newPair.refreshToken,
    );
    expect(forwardedCookie(response)).toContain(
      `ecom_access=${newPair.accessToken}`,
    );
  });

  it('clears the cookies and redirects to /login when the refresh is rejected', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: 'Invalid refresh token' }, { status: 403 }),
    );

    const response = await proxy(
      request('/dashboard', withSession(expiringAccess())),
    );

    expect(redirectPath(response)).toBe('/login');
    const cleared = response.headers.getSetCookie();
    expect(cleared).toHaveLength(2);
    expect(
      cleared.every((cookie) => cookie.includes('Expires=Thu, 01 Jan 1970')),
    ).toBe(true);
  });

  it.each([
    [
      'a 5xx',
      () => fetchMock.mockResolvedValue(Response.json({}, { status: 503 })),
    ],
    [
      'a network failure',
      () => fetchMock.mockRejectedValue(new TypeError('fetch failed')),
    ],
  ])(
    'passes the request through unchanged after %s',
    async (_case, arrange) => {
      arrange();

      const response = await proxy(
        request('/dashboard', withSession(expiringAccess())),
      );

      expect(redirectPath(response)).toBeNull();
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(response.headers.has('x-middleware-request-cookie')).toBe(false);
    },
  );
});
