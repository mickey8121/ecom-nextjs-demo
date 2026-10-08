import 'server-only';

import type { ListPage } from '@/shared/api';
import type { AuthenticatedClient } from '@/shared/api/index.server';

import {
  toProductDto,
  type ProductDto,
  type ProductPayload,
} from '../model/product';

const SELECTED_FIELDS = [
  'title',
  'price',
  'thumbnail',
  'category',
  'rating',
] as const satisfies readonly (keyof ProductDto)[];

type ProductsPayload = {
  products: ProductPayload[];
  total: number;
  skip: number;
  limit: number;
};

export async function getProducts(
  client: AuthenticatedClient,
  { skip, limit }: { skip: number; limit: number },
): Promise<ListPage<ProductDto>> {
  const payload = await client.request<ProductsPayload>({
    path: '/auth/products',
    query: { skip, limit, select: SELECTED_FIELDS.join(',') },
  });

  return {
    items: payload.products.map(toProductDto),
    total: payload.total,
    skip: payload.skip,
    limit: payload.limit,
  };
}
