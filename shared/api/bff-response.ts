import 'server-only';

import { unstable_rethrow } from 'next/navigation';

import { AppError, ERROR_CATALOG, type ErrorCode } from './errors';

export type BffErrorBody = {
  error: { code: ErrorCode; message: string };
};

export function errorResponse(code: ErrorCode) {
  const { status, message } = ERROR_CATALOG[code];
  return Response.json({ error: { code, message } } satisfies BffErrorBody, {
    status,
  });
}

export function toErrorResponse(error: unknown) {
  // Framework control flow (redirects, prerender bailouts) must not become a 500.
  unstable_rethrow(error);

  if (error instanceof AppError) return errorResponse(error.code);

  console.error('unexpected route handler error', error);
  return errorResponse('INTERNAL_ERROR');
}
