import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryStorage } from '@/test/memory-storage';

import { bffRequest } from './bff-client';
import { AppError, ERROR_CATALOG } from './errors';

const fetchMock = vi.fn<typeof fetch>();
const assign = vi.fn<(url: string) => void>();
let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('window', { location: { assign } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  assign.mockReset();
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
  if (!(error instanceof AppError)) {
    throw new Error('Expected the request to fail with an AppError');
  }
  return error;
}

function bffError(code: string, message = 'server message', status = 400) {
  return Response.json({ error: { code, message } }, { status });
}

describe('bffRequest', () => {
  it('returns the parsed body of a successful response', async () => {
    fetchMock.mockResolvedValue(Response.json({ items: [], total: 0 }));

    const result = await bffRequest('/api/products', {
      query: { skip: 5, limit: 5, unused: undefined },
    });

    const { url, init, headers } = lastRequest();
    expect(result).toEqual({ items: [], total: 0 });
    expect(url).toBe('/api/products?skip=5&limit=5');
    expect(init?.method).toBe('GET');
    expect(headers.has('content-type')).toBe(false);
  });

  it('sends a JSON body', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ cart: { id: 1 } }, { status: 201 }),
    );

    await bffRequest('/api/carts', { method: 'POST', body: { productId: 3 } });

    const { init, headers } = lastRequest();
    expect(init?.body).toBe('{"productId":3}');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('returns undefined for 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      bffRequest('/api/auth/logout', { method: 'POST' }),
    ).resolves.toBeUndefined();
  });

  it('turns the error shape into an AppError with the catalog message', async () => {
    fetchMock.mockResolvedValue(
      bffError('NOT_FOUND', 'raw upstream text', 404),
    );

    const error = await failure(bffRequest('/api/products'));

    expect(error.code).toBe('NOT_FOUND');
    expect(error.status).toBe(404);
    expect(error.message).toBe(ERROR_CATALOG.NOT_FOUND.message);
    expect(assign).not.toHaveBeenCalled();
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await failure(bffRequest('/api/products'));

    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toBe(ERROR_CATALOG.NETWORK_ERROR.message);
  });

  it('maps an HTML error page to UPSTREAM_ERROR', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>502 Bad Gateway</html>', { status: 502 }),
    );

    const error = await failure(bffRequest('/api/products'));

    expect(error.code).toBe('UPSTREAM_ERROR');
    expect(error.status).toBe(502);
    expect(error.message).toBe(ERROR_CATALOG.UPSTREAM_ERROR.message);
  });

  it('maps an error body with an unknown code to UPSTREAM_ERROR', async () => {
    fetchMock.mockResolvedValue(bffError('SOMETHING_ELSE', 'raw text', 500));

    const error = await failure(bffRequest('/api/products'));

    expect(error.code).toBe('UPSTREAM_ERROR');
    expect(error.message).not.toContain('raw text');
  });

  it('maps a non-JSON success body to UPSTREAM_ERROR', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));

    const error = await failure(bffRequest('/api/products'));

    expect(error.code).toBe('UPSTREAM_ERROR');
    expect(error.message).toBe(ERROR_CATALOG.UPSTREAM_ERROR.message);
  });

  it('clears session data, then navigates to /login on UNAUTHENTICATED', async () => {
    storage.setItem('ecom:carts:1', '[]');
    storage.setItem('theme', 'dark');
    let keysWhenNavigating: string[] = [];
    assign.mockImplementation(() => {
      keysWhenNavigating = storage.keys();
    });
    fetchMock.mockResolvedValue(bffError('UNAUTHENTICATED', 'expired', 401));

    const error = await failure(bffRequest('/api/products'));

    expect(error.code).toBe('UNAUTHENTICATED');
    expect(assign).toHaveBeenCalledExactlyOnceWith('/login');
    expect(keysWhenNavigating).toEqual(['theme']);
  });

  it('does not navigate on INVALID_CREDENTIALS', async () => {
    fetchMock.mockResolvedValue(bffError('INVALID_CREDENTIALS', 'nope', 401));

    const error = await failure(
      bffRequest('/api/auth/login', { method: 'POST', body: {} }),
    );

    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(assign).not.toHaveBeenCalled();
  });
});
