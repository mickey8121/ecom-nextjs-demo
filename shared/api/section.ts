import 'server-only';

import { redirect, unstable_rethrow } from 'next/navigation';

import { AppError } from './errors';

export type SectionResult<T> =
  { ok: true; data: T } | { ok: false; message: string };

export async function loadSection<T>(
  load: Promise<T>,
): Promise<SectionResult<T>> {
  try {
    return { ok: true, data: await load };
  } catch (error) {
    return { ok: false, message: sectionErrorMessage(error) };
  }
}

function sectionErrorMessage(error: unknown) {
  unstable_rethrow(error);
  if (!(error instanceof AppError)) throw error;
  // Server Components cannot clear cookies; the proxy clears them on this URL.
  if (error.code === 'UNAUTHENTICATED') redirect('/login?session=expired');
  return error.message;
}
