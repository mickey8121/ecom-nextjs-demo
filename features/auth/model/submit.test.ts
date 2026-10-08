import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/shared/api';
import { MemoryStorage } from '@/test/memory-storage';

import { submitLogin, submitLogout } from './submit';

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

const credentials = { username: 'emilys', password: 'emilyspass' };

describe('submitLogin', () => {
  it('posts the credentials and loads the dashboard', async () => {
    fetchMock.mockResolvedValue(Response.json({ user: { id: 1 } }));

    await submitLogin(credentials);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(credentials);
    expect(assign).toHaveBeenCalledExactlyOnceWith('/dashboard');
  });

  it('throws the catalog error and stays on the page', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'x' } },
        { status: 401 },
      ),
    );

    await expect(submitLogin(credentials)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('submitLogout', () => {
  it('logs out, clears session data, then loads the login page', async () => {
    storage.setItem('ecom:carts:1', '[]');
    let keysWhenNavigating: string[] = [];
    assign.mockImplementation(() => {
      keysWhenNavigating = storage.keys();
    });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await submitLogout();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/logout');
    expect(init?.method).toBe('POST');
    expect(assign).toHaveBeenCalledExactlyOnceWith('/login');
    expect(keysWhenNavigating).toEqual([]);
  });

  it('keeps the session when the logout request fails', async () => {
    storage.setItem('ecom:carts:1', '[]');
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await submitLogout().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'NETWORK_ERROR' });
    expect(storage.keys()).toEqual(['ecom:carts:1']);
    expect(assign).not.toHaveBeenCalled();
  });
});
