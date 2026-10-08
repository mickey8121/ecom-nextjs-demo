import type { ProductDto } from '@/entities/product';
import { bffRequest, type ListPage } from '@/shared/api';

export type PageQuery = {
  skip: number;
  limit: number;
};

export function fetchProductsPage(query: PageQuery) {
  return bffRequest<ListPage<ProductDto>>('/api/products', { query });
}
