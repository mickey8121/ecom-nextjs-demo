import { clearSessionData, navigateFullPage } from '@/shared/lib';

import { AppError, isErrorCode } from './errors';

type BffRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

export async function bffRequest<T>(
  path: `/api/${string}`,
  { method = 'GET', query, body }: BffRequestOptions = {},
): Promise<T> {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined) search.set(name, String(value));
  }
  const url = search.size > 0 ? `${path}?${search}` : path;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new AppError('NETWORK_ERROR', { cause: error });
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new AppError('UPSTREAM_ERROR', {
        status: response.status,
        cause: error,
      });
    }
  }

  const error = await toBffError(response);
  if (error.code === 'UNAUTHENTICATED') endSession();
  throw error;
}

async function toBffError(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  const code = readErrorCode(body);
  return new AppError(code ?? 'UPSTREAM_ERROR', { status: response.status });
}

function readErrorCode(body: unknown) {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return null;
  }
  const { error } = body;
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  return isErrorCode(error.code) ? error.code : null;
}

function endSession() {
  clearSessionData();
  navigateFullPage('/login');
}
