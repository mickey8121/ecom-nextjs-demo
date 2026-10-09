import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryStorage } from '@/test/memory-storage';

import type { CartDto, CartItemDto } from './cart';
import { cartStorageKey, createCartStore } from './cart-store';

const item = (
  id: number,
  price: number,
  discountedTotal: number,
): CartItemDto => ({
  id,
  title: `Product ${id}`,
  price,
  quantity: 1,
  total: price,
  discountedTotal,
  thumbnail: `https://cdn.dummyjson.com/${id}.webp`,
});

const mascara = item(1, 9.99, 9);
const helmet = item(144, 44.99, 41);
const perfume = item(6, 49.99, 44);
const fragrance = item(8, 89.99, 79);

const returned = (line: CartItemDto, id = 209): CartDto => ({
  id,
  items: [line],
  total: line.total,
  discountedTotal: line.discountedTotal,
  totalQuantity: line.quantity,
});

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('sessionStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const stored = (userId: number) =>
  JSON.parse(storage.getItem(cartStorageKey(userId)) ?? 'null');

describe('cart store', () => {
  it('stores the first cart as returned', () => {
    const store = createCartStore(7);
    const cart: CartDto = {
      id: 209,
      items: [mascara, { ...helmet, quantity: 4, total: 179.96 }],
      total: 189.95000000000002,
      discountedTotal: 172,
      totalQuantity: 5,
    };

    store.getState().addToCart(cart);

    expect(store.getState().cart).toEqual(cart);
  });

  it('appends a new product as a line and recomputes the totals', () => {
    const store = createCartStore(7);

    store.getState().addToCart(returned(mascara));
    store.getState().addToCart(returned(helmet));

    expect(store.getState().cart).toEqual({
      id: 209,
      items: [mascara, helmet],
      total: 54.98,
      discountedTotal: 50,
      totalQuantity: 2,
    });

    store.getState().addToCart(returned(perfume));

    expect(store.getState().cart).toEqual({
      id: 209,
      items: [mascara, helmet, perfume],
      total: 104.97,
      discountedTotal: 94,
      totalQuantity: 3,
    });
  });

  it('adds up quantity and totals on the line of a product already in the cart', () => {
    const store = createCartStore(7);

    store.getState().addToCart(returned(mascara));
    store.getState().addToCart(returned(fragrance));
    store.getState().addToCart(returned(fragrance));
    store.getState().addToCart(returned(fragrance));

    expect(store.getState().cart).toEqual({
      id: 209,
      items: [
        mascara,
        { ...fragrance, quantity: 3, total: 269.97, discountedTotal: 237 },
      ],
      total: 279.96,
      discountedTotal: 246,
      totalQuantity: 4,
    });
  });

  it('keeps the id DummyJSON returned for the first cart', () => {
    const store = createCartStore(7);

    store.getState().addToCart(returned(mascara, 209));
    store.getState().addToCart(returned(helmet, 210));

    expect(store.getState().cart?.id).toBe(209);
  });

  it('persists to sessionStorage under a key per user id', () => {
    createCartStore(7).getState().addToCart(returned(mascara, 209));
    createCartStore(8).getState().addToCart(returned(helmet, 210));

    expect(cartStorageKey(7)).toBe('ecom:carts:7');
    expect(stored(7).state).toEqual({ cart: returned(mascara, 209) });
    expect(stored(8).state).toEqual({ cart: returned(helmet, 210) });
  });

  it('clears the cart and its storage entry', () => {
    const store = createCartStore(7);
    store.getState().addToCart(returned(mascara));

    store.getState().clear();

    expect(store.getState().cart).toBeNull();
    expect(stored(7).state).toEqual({ cart: null });
  });

  it('starts empty and loads the saved cart only on rehydrate', async () => {
    createCartStore(7).getState().addToCart(returned(mascara));

    const store = createCartStore(7);
    expect(store.getState().cart).toBeNull();

    await store.persist.rehydrate();
    expect(store.getState().cart).toEqual(returned(mascara));
  });

  it('drops a state saved in the previous shape on rehydrate, without an error', async () => {
    const error = vi.spyOn(console, 'error');
    storage.setItem(
      cartStorageKey(7),
      JSON.stringify({ state: { carts: [returned(mascara)] }, version: 0 }),
    );

    const store = createCartStore(7);
    await store.persist.rehydrate();

    expect(store.getState().cart).toBeNull();
    expect(stored(7)).toEqual({ state: { cart: null }, version: 1 });
    expect(error).not.toHaveBeenCalled();
  });

  it('gives every mount its own store', () => {
    const first = createCartStore(7);
    const second = createCartStore(7);

    first.getState().addToCart(returned(mascara));

    expect(first).not.toBe(second);
    expect(second.getState().cart).toBeNull();
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
