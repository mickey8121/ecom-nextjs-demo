import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ERROR_CATALOG } from '@/shared/api';
import { makeJwt } from '@/test/jwt';
import { FakeCookies, mockCookies } from '@/test/next-headers';

import { POST } from './route';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const NOW_SECONDS = 1_800_000_000;
const item = {
  id: 3,
  title: 'Powder Canister',
  price: 14.99,
  quantity: 1,
  total: 14.99,
  thumbnail: 'https://cdn.dummyjson.com/3.webp',
};
const cartPayload = {
  id: 209,
  products: [{ ...item, discountedPrice: 14 }],
  total: 14.99,
  discountedTotal: 14,
  userId: 1,
  totalProducts: 1,
  totalQuantity: 1,
};

const fetchMock = vi.fn<typeof fetch>();
const consoleError = vi.spyOn(console, 'error');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW_SECONDS * 1000);
  vi.stubGlobal('fetch', fetchMock);
  consoleError.mockImplementation(() => {});
  mockCookies(
    new FakeCookies({
      ecom_access: makeJwt({ id: 1, exp: NOW_SECONDS + 60 }),
      ecom_refresh: makeJwt({ id: 1, exp: NOW_SECONDS + 3600 }),
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  consoleError.mockReset();
});

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/carts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

const upstreamBody = () => {
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse(String(init?.body));
};

function errorBody(code: keyof typeof ERROR_CATALOG) {
  return { error: { code, message: ERROR_CATALOG[code].message } };
}

describe('POST /api/carts', () => {
  it('creates a cart for the session user and returns 201 { cart }', async () => {
    fetchMock.mockResolvedValue(Response.json(cartPayload, { status: 201 }));

    const response = await post({ productId: 3 });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      cart: {
        id: 209,
        items: [{ ...item, discountedTotal: 14 }],
        total: 14.99,
        discountedTotal: 14,
        totalQuantity: 1,
      },
    });
    expect(upstreamBody()).toEqual({
      userId: 1,
      products: [{ id: 3, quantity: 1 }],
    });
  });

  it('takes the user id from the session, never from the body', async () => {
    fetchMock.mockResolvedValue(Response.json(cartPayload, { status: 201 }));

    await post({ productId: 3, quantity: 2, userId: 999 });

    expect(upstreamBody()).toEqual({
      userId: 1,
      products: [{ id: 3, quantity: 2 }],
    });
  });

  it.each([
    ['a missing product id', {}],
    ['a zero product id', { productId: 0 }],
    ['a string product id', { productId: '3' }],
    ['a fractional quantity', { productId: 3, quantity: 1.5 }],
    ['a quantity above 10', { productId: 3, quantity: 11 }],
  ])('rejects %s with VALIDATION_ERROR', async (_case, body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(errorBody('VALIDATION_ERROR'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a request without a session', async () => {
    mockCookies(new FakeCookies());

    const response = await post({ productId: 3 });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(errorBody('UNAUTHENTICATED'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an upstream failure to UPSTREAM_ERROR without its text', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { message: 'Product with id 3 not found' },
        { status: 500 },
      ),
    );

    const response = await post({ productId: 3 });
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).not.toContain('not found');
  });
});
