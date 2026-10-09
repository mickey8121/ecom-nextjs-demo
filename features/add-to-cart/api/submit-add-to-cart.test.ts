import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { submitAddToCart } from './submit-add-to-cart';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('submitAddToCart', () => {
  it('posts one unit of the product and returns the created cart', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ cart: { id: 209 } }, { status: 201 }),
    );

    const cart = await submitAddToCart(3);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/carts');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      productId: 3,
      quantity: 1,
    });
    expect(cart).toEqual({ id: 209 });
  });
});
