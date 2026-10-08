import { describe, expect, it } from 'vitest';

import { toProductDto } from './product';

describe('toProductDto', () => {
  it('keeps only the DTO fields', () => {
    const product = {
      id: 1,
      title: 'Essence Mascara Lash Princess',
      price: 9.99,
      thumbnail:
        'https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp',
      category: 'beauty',
      rating: 2.56,
    };

    expect(
      toProductDto({ ...product, stock: 99, tags: ['beauty'], images: [] }),
    ).toEqual(product);
  });
});
