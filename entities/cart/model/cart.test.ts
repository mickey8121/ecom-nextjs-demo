import { describe, expect, it } from 'vitest';

import { toCartDto } from './cart';

const item = {
  id: 1,
  title: 'Essence Mascara Lash Princess',
  price: 9.99,
  quantity: 2,
  total: 19.98,
  thumbnail:
    'https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp',
};

describe('toCartDto', () => {
  it('maps products to items and keeps only the DTO fields', () => {
    const payload = {
      id: 209,
      products: [{ ...item, discountPercentage: 10.48, discountedPrice: 18 }],
      total: 19.98,
      discountedTotal: 18,
      userId: 1,
      totalProducts: 1,
      totalQuantity: 2,
    };

    expect(toCartDto(payload)).toEqual({
      id: 209,
      items: [item],
      total: 19.98,
      discountedTotal: 18,
      totalQuantity: 2,
    });
  });
});
