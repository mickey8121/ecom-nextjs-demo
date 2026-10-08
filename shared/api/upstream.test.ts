import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE_URL, UPSTREAM_TIMEOUT_MS } from '@/shared/config';

import { ERROR_CATALOG } from './errors';
import { UpstreamError, upstreamRequest } from './upstream';

const fetchMock = vi.fn<typeof fetch>();
const consoleError = vi.spyOn(console, 'error');

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  consoleError.mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  consoleError.mockReset();
});

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) ?? [];
  return { url: String(url), init, headers: new Headers(init?.headers) };
}

async function failure(request: Promise<unknown>) {
  const error = await request.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof UpstreamError)) {
    throw new Error('Expected the request to fail with an UpstreamError');
  }
  return error;
}

describe('upstreamRequest', () => {
  it('sends an uncached JSON request with a timeout and returns the body', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    fetchMock.mockResolvedValue(Response.json({ id: 1 }));

    const result = await upstreamRequest<{ id: number }>({
      path: '/auth/products',
      query: { limit: 5, skip: undefined },
      token: 'access-token',
    });

    const { url, init, headers } = lastRequest();
    expect(result).toEqual({ id: 1 });
    expect(url).toBe(`${API_BASE_URL}/auth/products?limit=5`);
    expect(init?.method).toBe('GET');
    expect(init?.cache).toBe('no-store');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(timeout).toHaveBeenCalledWith(UPSTREAM_TIMEOUT_MS);
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('authorization')).toBe('Bearer access-token');
    timeout.mockRestore();
  });

  it('sends a JSON body and no authorization without a token', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));

    await upstreamRequest({
      path: '/auth/login',
      method: 'POST',
      body: { username: 'emilys' },
    });

    const { init, headers } = lastRequest();
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"username":"emilys"}');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.has('authorization')).toBe(false);
  });

  it('maps 404 to NOT_FOUND', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { message: "Product with id '0' not found" },
        { status: 404 },
      ),
    );

    const error = await failure(upstreamRequest({ path: '/auth/products/0' }));

    expect(error.code).toBe('NOT_FOUND');
    expect(error.status).toBe(404);
    expect(error.upstreamStatus).toBe(404);
  });

  it('maps 5xx to UPSTREAM_ERROR without exposing the upstream message', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: 'invalid token' }, { status: 500 }),
    );

    const error = await failure(upstreamRequest({ path: '/auth/me' }));

    expect(error.code).toBe('UPSTREAM_ERROR');
    expect(error.status).toBe(502);
    expect(error.upstreamStatus).toBe(500);
    expect(error.message).toBe(ERROR_CATALOG.UPSTREAM_ERROR.message);
    expect(String(error)).not.toContain('invalid token');
  });

  it('keeps a 401 recognisable', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: 'Token Expired!' }, { status: 401 }),
    );

    const error = await failure(upstreamRequest({ path: '/auth/me' }));

    expect(error.upstreamStatus).toBe(401);
    expect(error.code).toBe('UPSTREAM_ERROR');
  });

  it('maps a network failure to UPSTREAM_ERROR', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const error = await failure(upstreamRequest({ path: '/auth/me' }));

    expect(error.code).toBe('UPSTREAM_ERROR');
    expect(error.upstreamStatus).toBeNull();
    expect(error.message).not.toContain('fetch failed');
  });

  it('maps a timeout to UPSTREAM_ERROR', async () => {
    fetchMock.mockRejectedValue(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      ),
    );

    const error = await failure(upstreamRequest({ path: '/auth/me' }));

    expect(error.code).toBe('UPSTREAM_ERROR');
    expect(error.upstreamStatus).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      'upstream request failed',
      expect.objectContaining({
        upstreamMessage: expect.stringContaining('TimeoutError'),
      }),
    );
  });

  it('maps a non-JSON success body to UPSTREAM_ERROR', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>Bad gateway</html>', { status: 200 }),
    );

    const error = await failure(upstreamRequest({ path: '/auth/me' }));

    expect(error.code).toBe('UPSTREAM_ERROR');
    expect(error.upstreamStatus).toBe(200);
  });

  it('logs the failure without tokens or request bodies', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: 'invalid token' }, { status: 500 }),
    );

    await failure(
      upstreamRequest({
        path: '/auth/login',
        method: 'POST',
        body: { username: 'emilys', password: 'secret-password' },
        token: 'secret-token',
      }),
    );

    expect(consoleError).toHaveBeenCalledWith('upstream request failed', {
      method: 'POST',
      path: '/auth/login',
      status: 500,
      durationMs: expect.any(Number),
      upstreamMessage: 'invalid token',
    });
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain('secret-token');
    expect(logged).not.toContain('secret-password');
  });
});
