'use client';

import { ERROR_CATALOG } from '@/shared/api';
import { Alert, Button } from '@/shared/ui';

type DashboardErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function DashboardError({ retry }: DashboardErrorProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-4 py-6">
      <Alert variant="error">{ERROR_CATALOG.INTERNAL_ERROR.message}</Alert>
      <Button onClick={retry}>Try again</Button>
    </main>
  );
}
