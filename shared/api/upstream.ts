import 'server-only';

import { unstable_rethrow } from 'next/navigation';

import { API_BASE_URL, UPSTREAM_TIMEOUT_MS } from '@/shared/config';

import { AppError, type ErrorCode } from './errors';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type UpstreamRequest = {
  path: `/${string}`;
  method?: HttpMethod;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  token?: string;
};

export class UpstreamError extends AppError {
  readonly upstreamStatus: number | null;

  constructor(
    code: ErrorCode,
    upstreamStatus: number | null,
    options: { cause?: unknown } = {},
  ) {
    super(code, options);
    this.name = 'UpstreamError';
    this.upstreamStatus = upstreamStatus;
  }
}

const UPSTREAM_MESSAGE_MAX_LENGTH = 200;

export async function upstreamRequest<T>({
  path,
  method = 'GET',
  query,
  body,
  token,
}: UpstreamRequest): Promise<T> {
  const url = new URL(path, API_BASE_URL);
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }

  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const startedAt = performance.now();
  const fail = (
    status: number | null,
    upstreamMessage: string,
    cause?: unknown,
  ): never => {
    console.error('upstream request failed', {
      method,
      path,
      status,
      durationMs: Math.round(performance.now() - startedAt),
      upstreamMessage: upstreamMessage.slice(0, UPSTREAM_MESSAGE_MAX_LENGTH),
    });
    throw new UpstreamError(
      status === 404 ? 'NOT_FOUND' : 'UPSTREAM_ERROR',
      status,
      { cause },
    );
  };

  let response: Response | undefined;
  let text: string;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    text = await response.text();
  } catch (error) {
    // Next.js aborts prerenders by rejecting pending fetches; those errors must reach the framework.
    unstable_rethrow(error);
    return fail(response?.status ?? null, describeException(error), error);
  }

  if (!response.ok) return fail(response.status, readUpstreamMessage(text));

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    return fail(response.status, 'Response body is not JSON', error);
  }
}

function readUpstreamMessage(text: string) {
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'message' in parsed &&
      typeof parsed.message === 'string'
    ) {
      return parsed.message;
    }
  } catch {
    return text;
  }
  return text;
}

function describeException(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
