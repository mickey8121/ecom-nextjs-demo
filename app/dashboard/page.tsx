import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthenticatedDashboard } from './authenticated-dashboard';
import { DashboardFrame, HeaderPlaceholder, SectionLoading } from './frame';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Suspense
        fallback={
          <DashboardFrame
            header={<HeaderPlaceholder />}
            carts={<SectionLoading label="Loading carts…" />}
            products={<SectionLoading label="Loading products…" />}
          />
        }
      >
        <AuthenticatedDashboard />
      </Suspense>
    </main>
  );
}
