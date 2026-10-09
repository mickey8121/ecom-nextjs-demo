'use client';

import { CartCard, type CartDto, useCartStore } from '@/entities/cart';

export function CartOverview({ serverCarts }: { serverCarts: CartDto[] }) {
  const addedCart = useCartStore((state) => state.cart);

  if (!addedCart && serverCarts.length === 0) {
    return <p className="text-sm text-zinc-500">You have no carts yet.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {addedCart && (
        <CartCard
          cart={addedCart}
          badge={
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Added in this session
            </span>
          }
        />
      )}
      {serverCarts.map((cart) => (
        <CartCard key={cart.id} cart={cart} />
      ))}
    </div>
  );
}
