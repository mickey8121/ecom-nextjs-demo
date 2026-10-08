'use client';

import { ProductCard, type ProductDto } from '@/entities/product';
import {
  LoadMoreButton,
  useProductPagination,
} from '@/features/product-pagination';
import type { ListPage } from '@/shared/api';

export function ProductFeed({
  initialPage,
}: {
  initialPage: ListPage<ProductDto>;
}) {
  const { items, total, pending, hasMore, loadMore } =
    useProductPagination(initialPage);

  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">No products found.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((product) => (
          <li key={product.id} className="grid">
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-500">
          Showing {items.length} of {total}
        </p>
        {hasMore && <LoadMoreButton pending={pending} onClick={loadMore} />}
      </div>
    </div>
  );
}
