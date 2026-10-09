import { describe, expect, it } from 'vitest';

import { toAddedCartDto, toCartDto } from './cart';

const product = {
  id: 1,
  title: 'Essence Mascara Lash Princess',
  price: 9.99,
  quantity: 2,
  total: 19.98,
  thumbnail:
    'https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp',
};

const cartFields = {
  id: 209,
  total: 19.98,
  discountedTotal: 17.89,
  userId: 1,
  totalProducts: 1,
  totalQuantity: 2,
};

const expected = {
  id: 209,
  items: [{ ...product, discountedTotal: 17.89 }],
  total: 19.98,
  discountedTotal: 17.89,
  totalQuantity: 2,
};

describe('toCartDto', () => {
  it('maps the per-item discountedTotal and keeps only the DTO fields', () => {
    const payload = {
      ...cartFields,
      products: [
        { ...product, discountPercentage: 10.48, discountedTotal: 17.89 },
      ],
    };

    expect(toCartDto(payload)).toEqual(expected);
  });
});

describe('toAddedCartDto', () => {
  it('maps the per-item discountedPrice to discountedTotal and keeps only the DTO fields', () => {
    const payload = {
      ...cartFields,
      products: [
        { ...product, discountPercentage: 10.48, discountedPrice: 17.89 },
      ],
    };

    expect(toAddedCartDto(payload)).toEqual(expected);
  });
});
