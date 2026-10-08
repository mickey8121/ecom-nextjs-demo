'use client';

import { useSearchParams } from 'next/navigation';

import { ERROR_CATALOG } from '@/shared/api';
import { Alert } from '@/shared/ui';

export function SessionExpiredNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get('session') !== 'expired') return null;

  return <Alert variant="info">{ERROR_CATALOG.UNAUTHENTICATED.message}</Alert>;
}
