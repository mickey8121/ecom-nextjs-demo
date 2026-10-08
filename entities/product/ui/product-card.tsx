import Image from 'next/image';
import type { ReactNode } from 'react';

import { formatPrice } from '@/shared/lib';

import type { ProductDto } from '../model/product';

type ProductCardProps = {
  product: ProductDto;
  actions?: ReactNode;
};

export function ProductCard({ product, actions }: ProductCardProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <Image
        src={product.thumbnail}
        alt={product.title}
        width={300}
        height={300}
        className="aspect-square w-full bg-zinc-100 object-contain"
      />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs tracking-wide text-zinc-500 uppercase">
          {product.category}
        </p>
        <h3 className="font-medium">{product.title}</h3>
        <div className="mt-auto flex items-center justify-between pt-2 text-sm">
          <span className="font-semibold">{formatPrice(product.price)}</span>
          <span className="text-zinc-500">
            <span aria-hidden>★ </span>
            {product.rating.toFixed(1)}
            <span className="sr-only"> out of 5</span>
          </span>
        </div>
        {actions && <div className="pt-3">{actions}</div>}
      </div>
    </article>
  );
}
