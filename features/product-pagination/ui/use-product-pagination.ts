'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useStore } from 'zustand';

import type { ProductDto } from '@/entities/product';
import { toUserMessage, type ListPage } from '@/shared/api';

import { createPaginationStore, hasMore } from '../model/pagination-store';

export function useProductPagination(initialPage: ListPage<ProductDto>) {
  const [store] = useState(() => createPaginationStore(initialPage));
  const items = useStore(store, (state) => state.items);
  const total = useStore(store, (state) => state.total);
  const pending = useStore(store, (state) => state.pending);

  function loadMore() {
    store
      .getState()
      .loadMore()
      .catch((error: unknown) => toast.error(toUserMessage(error)));
  }

  return {
    items,
    total,
    pending,
    hasMore: hasMore({ items, total }),
    loadMore,
  };
}
