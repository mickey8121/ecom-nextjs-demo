'use client';

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useStore } from 'zustand';

import {
  type CartStore,
  type CartStoreState,
  createCartStore,
} from '../model/cart-store';

const CartStoreContext = createContext<CartStore | null>(null);

type CartStoreProviderProps = {
  userId: number;
  children: ReactNode;
};

export function CartStoreProvider({
  userId,
  children,
}: CartStoreProviderProps) {
  const [store] = useState(() => createCartStore(userId));

  useEffect(() => {
    // `persist` is absent when sessionStorage is unavailable: the cart then lives in memory only.
    void store.persist?.rehydrate();
  }, [store]);

  return <CartStoreContext value={store}>{children}</CartStoreContext>;
}

export function useCartStore<T>(selector: (state: CartStoreState) => T): T {
  const store = useContext(CartStoreContext);
  if (!store) throw new Error('useCartStore requires a CartStoreProvider');
  return useStore(store, selector);
}
