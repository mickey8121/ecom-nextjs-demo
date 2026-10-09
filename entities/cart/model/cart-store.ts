import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { SESSION_STORAGE_PREFIX } from '@/shared/config';

import type { CartDto } from './cart';

export type CartStoreState = {
  carts: CartDto[];
  addCart(cart: CartDto): void;
  clear(): void;
};

export function cartStorageKey(userId: number) {
  return `${SESSION_STORAGE_PREFIX}carts:${userId}`;
}

export function createCartStore(userId: number) {
  return createStore<CartStoreState>()(
    persist(
      (set) => ({
        carts: [],
        addCart: (cart) => set((state) => ({ carts: [...state.carts, cart] })),
        clear: () => set({ carts: [] }),
      }),
      {
        name: cartStorageKey(userId),
        storage: createJSONStorage(() => sessionStorage),
        partialize: ({ carts }) => ({ carts }),
        skipHydration: true,
      },
    ),
  );
}

export type CartStore = ReturnType<typeof createCartStore>;
