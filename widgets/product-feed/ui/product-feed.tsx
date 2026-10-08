import { ProductCard, type ProductDto } from '@/entities/product';
import type { ListPage } from '@/shared/api';

export function ProductFeed({ page }: { page: ListPage<ProductDto> }) {
  if (page.items.length === 0) {
    return <p className="text-sm text-zinc-500">No products found.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {page.items.map((product) => (
          <li key={product.id} className="grid">
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
      <p className="text-sm text-zinc-500">
        Showing {page.items.length} of {page.total}
      </p>
    </div>
  );
}
