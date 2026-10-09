import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryStorage } from '@/test/memory-storage';

import type { CartDto } from './cart';
import { cartStorageKey, createCartStore } from './cart-store';

const cart = (id: number): CartDto => ({
  id,
  items: [
    {
      id: 1,
      title: 'Essence Mascara Lash Princess',
      price: 9.99,
      quantity: 1,
      total: 9.99,
      thumbnail: 'https://cdn.dummyjson.com/1.webp',
    },
  ],
  total: 9.99,
  discountedTotal: 8.94,
  totalQuantity: 1,
});

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('sessionStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const stored = (userId: number) =>
  JSON.parse(storage.getItem(cartStorageKey(userId)) ?? 'null');

describe('cart store', () => {
  it('persists to sessionStorage under a key per user id', () => {
    createCartStore(7).getState().addCart(cart(209));
    createCartStore(8).getState().addCart(cart(210));

    expect(cartStorageKey(7)).toBe('ecom:carts:7');
    expect(stored(7).state).toEqual({ carts: [cart(209)] });
    expect(stored(8).state).toEqual({ carts: [cart(210)] });
  });

  it('appends carts and clears them', () => {
    const store = createCartStore(7);

    store.getState().addCart(cart(209));
    store.getState().addCart(cart(209));
    expect(store.getState().carts).toHaveLength(2);

    store.getState().clear();
    expect(store.getState().carts).toEqual([]);
    expect(stored(7).state).toEqual({ carts: [] });
  });

  it('starts empty and loads the saved carts only on rehydrate', async () => {
    createCartStore(7).getState().addCart(cart(209));

    const store = createCartStore(7);
    expect(store.getState().carts).toEqual([]);

    await store.persist.rehydrate();
    expect(store.getState().carts).toEqual([cart(209)]);
  });

  it('gives every mount its own store', () => {
    const first = createCartStore(7);
    const second = createCartStore(7);

    first.getState().addCart(cart(209));

    expect(first).not.toBe(second);
    expect(second.getState().carts).toEqual([]);
  });

  it('creates nothing and touches no storage at module level', async () => {
    const getItem = vi.spyOn(storage, 'getItem');
    const setItem = vi.spyOn(storage, 'setItem');
    vi.resetModules();

    const cartStoreModule = await import('./cart-store');

    for (const value of Object.values(cartStoreModule)) {
      expect(typeof value).toBe('function');
    }
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
