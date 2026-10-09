import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { SESSION_STORAGE_PREFIX } from '@/shared/config';

import { type CartDto, mergeCart } from './cart';

export type CartStoreState = {
  cart: CartDto | null;
  addToCart(cart: CartDto): void;
  clear(): void;
};

export function cartStorageKey(userId: number) {
  return `${SESSION_STORAGE_PREFIX}carts:${userId}`;
}

export function createCartStore(userId: number) {
  return createStore<CartStoreState>()(
    persist(
      (set) => ({
        cart: null,
        addToCart: (cart) =>
          set((state) => ({ cart: mergeCart(state.cart, cart) })),
        clear: () => set({ cart: null }),
      }),
      {
        name: cartStorageKey(userId),
        storage: createJSONStorage(() => sessionStorage),
        partialize: ({ cart }) => ({ cart }),
        version: 1,
        // A cart from an older shape is display-only, so it is dropped rather than migrated.
        migrate: () => ({ cart: null }),
        skipHydration: true,
      },
    ),
  );
}

export type CartStore = ReturnType<typeof createCartStore>;
