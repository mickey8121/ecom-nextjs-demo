import { Suspense } from 'react';

import { getUserCarts } from '@/entities/cart/index.server';
import { getProducts } from '@/entities/product/index.server';
import { getCurrentUser } from '@/entities/user/index.server';
import {
  getServerComponentClient,
  loadSection,
} from '@/shared/api/index.server';
import { PRODUCTS_PAGE_SIZE } from '@/shared/config';
import { Alert } from '@/shared/ui';
import { CartOverview } from '@/widgets/cart-overview';
import { DashboardHeader } from '@/widgets/dashboard-header';
import { ProductFeed } from '@/widgets/product-feed';

import { DashboardFrame, SectionLoading } from './frame';
import { SectionData } from './section-data';

export async function AuthenticatedDashboard() {
  const client = await getServerComponentClient();

  const products = getProducts(client, { skip: 0, limit: PRODUCTS_PAGE_SIZE });
  // The products section awaits this; the no-op only covers a render that ends early on a redirect.
  products.catch(() => {});

  const user = await loadSection(getCurrentUser(client));
  const userFailure = user.ok ? null : (
    <Alert variant="error">{user.message}</Alert>
  );

  return (
    <DashboardFrame
      header={user.ok ? <DashboardHeader user={user.data} /> : userFailure}
      carts={
        user.ok ? (
          <Suspense fallback={<SectionLoading label="Loading carts…" />}>
            <SectionData load={getUserCarts(client, user.data.id)}>
              {(carts) => <CartOverview carts={carts} />}
            </SectionData>
          </Suspense>
        ) : (
          userFailure
        )
      }
      products={
        <Suspense fallback={<SectionLoading label="Loading products…" />}>
          <SectionData load={products}>
            {(page) => <ProductFeed page={page} />}
          </SectionData>
        </Suspense>
      }
    />
  );
}
