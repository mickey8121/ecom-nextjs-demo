'use client';

import { CartCard, type CartDto, useCartStore } from '@/entities/cart';

export function CartOverview({ serverCarts }: { serverCarts: CartDto[] }) {
  const addedCarts = useCartStore((state) => state.carts);

  if (serverCarts.length === 0 && addedCarts.length === 0) {
    return <p className="text-sm text-zinc-500">You have no carts yet.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {addedCarts.map((cart, index) => (
        <CartCard
          // DummyJSON gives every added cart the same id, so the position is the stable key.
          key={`added-${index}`}
          cart={cart}
          badge={
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Added in this session
            </span>
          }
        />
      ))}
      {serverCarts.map((cart) => (
        <CartCard key={cart.id} cart={cart} />
      ))}
    </div>
  );
}
