import { createStore } from 'zustand/vanilla';

import type { ProductDto } from '@/entities/product';
import type { ListPage } from '@/shared/api';
import { PRODUCTS_PAGE_SIZE } from '@/shared/config';

import { fetchProductsPage, type PageQuery } from '../api/fetch-products-page';

type ProductList = {
  items: ProductDto[];
  total: number;
};

export type PaginationState = ProductList & {
  pending: boolean;
  loadMore(): Promise<void>;
};

export function hasMore({ items, total }: ProductList) {
  return items.length < total;
}

export function appendPage(
  list: ProductList,
  page: ListPage<ProductDto>,
): ProductList {
  const known = new Set(list.items.map((product) => product.id));
  const fresh = page.items.filter((product) => !known.has(product.id));
  return { items: [...list.items, ...fresh], total: page.total };
}

export function createPaginationStore(
  initialPage: ListPage<ProductDto>,
  fetchPage: (
    query: PageQuery,
  ) => Promise<ListPage<ProductDto>> = fetchProductsPage,
) {
  return createStore<PaginationState>()((set, get) => ({
    items: initialPage.items,
    total: initialPage.total,
    pending: false,

    async loadMore() {
      const state = get();
      if (state.pending || !hasMore(state)) return;

      set({ pending: true });
      try {
        const page = await fetchPage({
          skip: state.items.length,
          limit: PRODUCTS_PAGE_SIZE,
        });
        set((current) => ({ ...appendPage(current, page), pending: false }));
      } catch (error) {
        set({ pending: false });
        throw error;
      }
    },
  }));
}
