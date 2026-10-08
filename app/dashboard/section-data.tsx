import type { ReactNode } from 'react';

import { loadSection } from '@/shared/api/index.server';
import { Alert } from '@/shared/ui';

type SectionDataProps<T> = {
  load: Promise<T>;
  children: (data: T) => ReactNode;
};

export async function SectionData<T>({ load, children }: SectionDataProps<T>) {
  const result = await loadSection(load);
  if (!result.ok) return <Alert variant="error">{result.message}</Alert>;
  return children(result.data);
}
