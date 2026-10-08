import type { ReactNode } from 'react';

import { Spinner } from '@/shared/ui';

type DashboardFrameProps = {
  header: ReactNode;
  carts: ReactNode;
  products: ReactNode;
};

export function DashboardFrame({
  header,
  carts,
  products,
}: DashboardFrameProps) {
  return (
    <div className="flex flex-col gap-8">
      {header}
      <section aria-labelledby="carts-heading" className="flex flex-col gap-4">
        <h2 id="carts-heading" className="text-lg font-semibold">
          Your carts
        </h2>
        {carts}
      </section>
      <section
        aria-labelledby="products-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="products-heading" className="text-lg font-semibold">
          Products
        </h2>
        {products}
      </section>
    </div>
  );
}

export function HeaderPlaceholder() {
  return (
    <div
      aria-hidden
      className="min-h-18 animate-pulse rounded-lg border border-zinc-200 bg-white"
    />
  );
}

export function SectionLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 text-sm text-zinc-500"
    >
      <Spinner />
      {label}
    </div>
  );
}
