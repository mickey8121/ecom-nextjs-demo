import { describe, expect, it } from 'vitest';

import { mockAuthenticatedClient } from '@/test/authenticated-client';

import { addCart, getUserCarts } from './carts';

const cartPayload = {
  id: 209,
  products: [
    {
      id: 1,
      title: 'Essence Mascara Lash Princess',
      price: 9.99,
      quantity: 2,
      total: 19.98,
      discountedPrice: 18,
      thumbnail:
        'https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp',
    },
  ],
  total: 19.98,
  discountedTotal: 18,
  userId: 1,
  totalProducts: 1,
  totalQuantity: 2,
};

describe('getUserCarts', () => {
  it("requests the user's carts and maps them", async () => {
    const { client, request } = mockAuthenticatedClient({
      carts: [cartPayload],
      total: 1,
      skip: 0,
      limit: 1,
    });

    const carts = await getUserCarts(client, 1);

    expect(request).toHaveBeenCalledExactlyOnceWith({
      path: '/auth/carts/user/1',
    });
    expect(carts).toHaveLength(1);
    expect(carts[0]).not.toHaveProperty('userId');
    expect(carts[0].items[0]).not.toHaveProperty('discountedPrice');
  });
});

describe('addCart', () => {
  it('posts the user id and the products as { id, quantity }', async () => {
    const { client, request } = mockAuthenticatedClient(cartPayload);

    const cart = await addCart(client, 7, [{ productId: 1, quantity: 2 }]);

    expect(request).toHaveBeenCalledExactlyOnceWith({
      path: '/auth/carts/add',
      method: 'POST',
      body: { userId: 7, products: [{ id: 1, quantity: 2 }] },
    });
    expect(cart.id).toBe(209);
    expect(cart.items).toHaveLength(1);
  });
});
