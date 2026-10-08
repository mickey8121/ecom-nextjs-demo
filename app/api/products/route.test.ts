import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ERROR_CATALOG } from '@/shared/api';
import { makeJwt } from '@/test/jwt';
import { FakeCookies, mockCookies } from '@/test/next-headers';

import { GET } from './route';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const NOW_SECONDS = 1_800_000_000;
const session = {
  ecom_access: makeJwt({ id: 1, exp: NOW_SECONDS + 30 }),
  ecom_refresh: makeJwt({ id: 1, exp: NOW_SECONDS + 3600 }),
};
const refreshed = {
  accessToken: makeJwt({ id: 1, exp: NOW_SECONDS + 60, refreshed: true }),
  refreshToken: makeJwt({ id: 1, exp: NOW_SECONDS + 7200 }),
};
const product = {
  id: 6,
  title: 'Calvin Klein CK One',
  price: 49.99,
  thumbnail:
    'https://cdn.dummyjson.com/product-images/fragrances/calvin-klein-ck-one/thumbnail.webp',
  category: 'fragrances',
  rating: 4.37,
};

const fetchMock = vi.fn<typeof fetch>();
const consoleError = vi.spyOn(console, 'error');
let jar: FakeCookies;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW_SECONDS * 1000);
  vi.stubGlobal('fetch', fetchMock);
  consoleError.mockImplementation(() => {});
  jar = new FakeCookies(session);
  mockCookies(jar);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  consoleError.mockReset();
});

const productsPage = (skip: number, limit: number) =>
  Response.json({
    products: [{ ...product, stock: 3 }],
    total: 194,
    skip,
    limit,
  });

const get = (query = '') =>
  GET(new NextRequest(`http://localhost/api/products${query}`));

function upstreamCalls(path: string) {
  return fetchMock.mock.calls
    .filter(([input]) => new URL(String(input)).pathname === path)
    .map(([input, init]) => ({
      url: new URL(String(input)),
      authorization: new Headers(init?.headers).get('authorization'),
    }));
}

function errorBody(code: keyof typeof ERROR_CATALOG) {
  return { error: { code, message: ERROR_CATALOG[code].message } };
}

describe('GET /api/products', () => {
  it('returns the list envelope for the requested page', async () => {
    fetchMock.mockResolvedValue(productsPage(5, 5));

    const response = await get('?skip=5&limit=5');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [product],
      total: 194,
      skip: 5,
      limit: 5,
    });
    const [call] = upstreamCalls('/auth/products');
    expect(call.url.searchParams.get('skip')).toBe('5');
    expect(call.url.searchParams.get('limit')).toBe('5');
    expect(call.authorization).toBe(`Bearer ${session.ecom_access}`);
  });

  it('defaults to the first page of five', async () => {
    fetchMock.mockResolvedValue(productsPage(0, 5));

    await get();

    const [call] = upstreamCalls('/auth/products');
    expect(call.url.searchParams.get('skip')).toBe('0');
    expect(call.url.searchParams.get('limit')).toBe('5');
  });

  it.each(['?skip=-1', '?skip=1.5', '?limit=0', '?limit=31', '?limit=abc'])(
    'rejects %s with VALIDATION_ERROR',
    async (query) => {
      const response = await get(query);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual(errorBody('VALIDATION_ERROR'));
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('rejects a request without a session', async () => {
    mockCookies(new FakeCookies());

    const response = await get();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(errorBody('UNAUTHENTICATED'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes once on an upstream 401, retries and sets the new cookies', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === '/auth/refresh') return Response.json(refreshed);
      const authorization = new Headers(init?.headers).get('authorization');
      return authorization === `Bearer ${refreshed.accessToken}`
        ? productsPage(0, 5)
        : Response.json({ message: 'Token Expired!' }, { status: 401 });
    });

    const response = await get();

    expect(response.status).toBe(200);
    expect(upstreamCalls('/auth/refresh')).toHaveLength(1);
    expect(
      upstreamCalls('/auth/products').map((call) => call.authorization),
    ).toEqual([
      `Bearer ${session.ecom_access}`,
      `Bearer ${refreshed.accessToken}`,
    ]);
    expect(jar.writes.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'ecom_access', value: refreshed.accessToken },
      { name: 'ecom_refresh', value: refreshed.refreshToken },
    ]);
  });

  it('ends the session when the refresh is rejected', async () => {
    fetchMock.mockImplementation(async (input) =>
      new URL(String(input)).pathname === '/auth/refresh'
        ? Response.json({ message: 'Invalid refresh token' }, { status: 403 })
        : Response.json({ message: 'Token Expired!' }, { status: 401 }),
    );

    const response = await get();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(errorBody('UNAUTHENTICATED'));
    expect(jar.deletions).toEqual(['ecom_access', 'ecom_refresh']);
  });

  it('maps an upstream failure to UPSTREAM_ERROR without its text', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: 'invalid token' }, { status: 500 }),
    );

    const response = await get();
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(JSON.parse(text)).toEqual(errorBody('UPSTREAM_ERROR'));
    expect(text).not.toContain('invalid token');
    expect(upstreamCalls('/auth/refresh')).toEqual([]);
  });
});
