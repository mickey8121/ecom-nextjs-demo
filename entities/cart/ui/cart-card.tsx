import Image from 'next/image';
import type { ReactNode } from 'react';

import { formatPrice } from '@/shared/lib';

import type { CartDto } from '../model/cart';

type CartCardProps = {
  cart: CartDto;
  badge?: ReactNode;
};

export function CartCard({ cart, badge }: CartCardProps) {
  const discounted = cart.discountedTotal < cart.total;

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Cart #{cart.id}</h3>
        {badge}
      </header>
      <ul className="mt-3 divide-y divide-zinc-100 text-sm">
        {cart.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-2">
            <Image
              src={item.thumbnail}
              alt=""
              width={40}
              height={40}
              className="size-10 rounded bg-zinc-100 object-contain"
            />
            <span className="flex-1">{item.title}</span>
            <span className="text-zinc-500">× {item.quantity}</span>
            <span className="w-24 text-right">{formatPrice(item.total)}</span>
          </li>
        ))}
      </ul>
      <footer className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3 text-sm">
        <span className="text-zinc-500">{cart.totalQuantity} items</span>
        <span>
          {discounted && (
            <s className="mr-2 text-zinc-400">{formatPrice(cart.total)}</s>
          )}
          <span className="font-semibold">
            {formatPrice(cart.discountedTotal)}
          </span>
        </span>
      </footer>
    </article>
  );
}
