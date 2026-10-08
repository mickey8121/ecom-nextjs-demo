import { describe, expect, it } from 'vitest';

import { mockAuthenticatedClient } from '@/test/authenticated-client';

import { getProducts } from './get-products';

const product = {
  id: 3,
  title: 'Powder Canister',
  price: 14.99,
  thumbnail:
    'https://cdn.dummyjson.com/product-images/beauty/powder-canister/thumbnail.webp',
  category: 'beauty',
  rating: 4.64,
};

describe('getProducts', () => {
  it('requests only the mapped fields and returns the list envelope', async () => {
    const { client, request } = mockAuthenticatedClient({
      products: [{ ...product, stock: 10 }],
      total: 194,
      skip: 2,
      limit: 1,
    });

    const page = await getProducts(client, { skip: 2, limit: 1 });

    expect(request).toHaveBeenCalledExactlyOnceWith({
      path: '/auth/products',
      query: {
        skip: 2,
        limit: 1,
        select: 'title,price,thumbnail,category,rating',
      },
    });
    expect(page).toEqual({ items: [product], total: 194, skip: 2, limit: 1 });
  });

  it('takes skip and limit from the upstream response', async () => {
    const { client } = mockAuthenticatedClient({
      products: [],
      total: 194,
      skip: 190,
      limit: 4,
    });

    const page = await getProducts(client, { skip: 190, limit: 5 });

    expect(page).toEqual({ items: [], total: 194, skip: 190, limit: 4 });
  });
});
