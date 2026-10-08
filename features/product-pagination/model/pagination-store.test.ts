import { describe, expect, it, vi } from 'vitest';

import type { ProductDto } from '@/entities/product';
import { AppError, type ListPage } from '@/shared/api';
import { deferred } from '@/test/deferred';

import { appendPage, createPaginationStore, hasMore } from './pagination-store';

const product = (id: number): ProductDto => ({
  id,
  title: `Product ${id}`,
  price: id,
  thumbnail: `https://cdn.dummyjson.com/${id}.webp`,
  category: 'beauty',
  rating: 4,
});

const page = (ids: number[], total = 12): ListPage<ProductDto> => ({
  items: ids.map(product),
  total,
  skip: 0,
  limit: ids.length,
});

const ids = (items: ProductDto[]) => items.map((item) => item.id);

describe('appendPage', () => {
  it('appends the next page and skips products already in the list', () => {
    const list = appendPage(page([1, 2, 3]), page([3, 4, 5], 13));

    expect(ids(list.items)).toEqual([1, 2, 3, 4, 5]);
    expect(list.total).toBe(13);
  });
});

describe('hasMore', () => {
  it('is false once every product is loaded', () => {
    expect(hasMore({ items: page([1, 2]).items, total: 3 })).toBe(true);
    expect(hasMore({ items: page([1, 2, 3]).items, total: 3 })).toBe(false);
  });
});

describe('pagination store', () => {
  it('requests the page after the loaded products and appends it', async () => {
    const fetchPage = vi.fn(async () => page([6, 7, 8, 9, 10]));
    const store = createPaginationStore(page([1, 2, 3, 4, 5]), fetchPage);

    await store.getState().loadMore();

    expect(fetchPage).toHaveBeenCalledExactlyOnceWith({ skip: 5, limit: 5 });
    expect(ids(store.getState().items)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(store.getState().pending).toBe(false);
  });

  it('ignores a second request while one is pending', async () => {
    const response = deferred<ListPage<ProductDto>>();
    const fetchPage = vi.fn(() => response.promise);
    const store = createPaginationStore(page([1, 2, 3, 4, 5]), fetchPage);

    const first = store.getState().loadMore();
    const second = store.getState().loadMore();
    expect(store.getState().pending).toBe(true);

    response.resolve(page([6, 7, 8, 9, 10]));
    await Promise.all([first, second]);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(store.getState().items).toHaveLength(10);
  });

  it('does not request anything once the list is complete', async () => {
    const fetchPage = vi.fn(async () => page([]));
    const store = createPaginationStore(page([1, 2, 3], 3), fetchPage);

    await store.getState().loadMore();

    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('keeps the list unchanged and rethrows when loading fails', async () => {
    const failure = new AppError('UPSTREAM_ERROR');
    const store = createPaginationStore(
      page([1, 2, 3, 4, 5]),
      vi.fn(async () => {
        throw failure;
      }),
    );
    const before = store.getState().items;

    await expect(store.getState().loadMore()).rejects.toBe(failure);

    expect(store.getState().items).toBe(before);
    expect(store.getState().pending).toBe(false);
  });

  it('gives every mount its own store', async () => {
    const fetchPage = vi.fn(async () => page([6]));
    const first = createPaginationStore(page([1, 2, 3, 4, 5]), fetchPage);
    const second = createPaginationStore(page([1, 2, 3, 4, 5]), fetchPage);

    await first.getState().loadMore();

    expect(first.getState().items).toHaveLength(6);
    expect(second.getState().items).toHaveLength(5);
  });
});
