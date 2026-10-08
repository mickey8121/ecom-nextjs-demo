import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deferred } from '@/test/deferred';

import { AppError } from '../errors';
import { UpstreamError } from '../upstream';
import {
  pendingRefreshCount,
  refreshSessionStore,
  refreshTokens,
} from './refresh';
import { createMemorySessionStore } from './store';

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

const pairFor = (refreshToken: string) => ({
  accessToken: `access-from-${refreshToken}`,
  refreshToken: `next-${refreshToken}`,
});

function respondWithPairs() {
  fetchMock.mockImplementation(async (_url, init) => {
    const { refreshToken } = JSON.parse(String(init?.body));
    return Response.json(pairFor(refreshToken));
  });
}

async function rejection(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('Expected the refresh to fail');
    },
    (reason: unknown) => reason,
  );
}

describe('refreshTokens', () => {
  it('posts the refresh token with the configured TTL', async () => {
    respondWithPairs();

    await refreshTokens('refresh-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(String(url)).pathname).toBe('/auth/refresh');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      refreshToken: 'refresh-1',
      expiresInMins: 1,
    });
  });

  it('runs one upstream refresh for concurrent callers of one session', async () => {
    const response = deferred<Response>();
    fetchMock.mockReturnValue(response.promise);

    const callers = Array.from({ length: 5 }, () => refreshTokens('refresh-1'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pendingRefreshCount()).toBe(1);

    response.resolve(Response.json(pairFor('refresh-1')));
    const results = await Promise.all(callers);

    expect(results.every((result) => result === results[0])).toBe(true);
    expect(results[0]).toEqual(pairFor('refresh-1'));
    expect(pendingRefreshCount()).toBe(0);
  });

  it('refreshes different sessions independently', async () => {
    respondWithPairs();

    const [first, second] = await Promise.all([
      refreshTokens('refresh-1'),
      refreshTokens('refresh-2'),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first).toEqual(pairFor('refresh-1'));
    expect(second).toEqual(pairFor('refresh-2'));
  });

  it('rejects every waiter when the refresh fails and clears the entry', async () => {
    const response = deferred<Response>();
    fetchMock.mockReturnValue(response.promise);

    const callers = Array.from({ length: 3 }, () =>
      rejection(refreshTokens('refresh-1')),
    );
    response.resolve(Response.json({ message: 'boom' }, { status: 500 }));
    const errors = await Promise.all(callers);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const error of errors) {
      expect(error).toBeInstanceOf(UpstreamError);
      expect(error).toMatchObject({ code: 'UPSTREAM_ERROR' });
    }
    expect(pendingRefreshCount()).toBe(0);
  });

  it('calls upstream again once the previous refresh has settled', async () => {
    respondWithPairs();

    await refreshTokens('refresh-1');
    await refreshTokens('refresh-1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403])('turns a %i into UNAUTHENTICATED', async (status) => {
    fetchMock.mockResolvedValue(
      Response.json({ message: 'Invalid refresh token' }, { status }),
    );

    const error = await rejection(refreshTokens('refresh-1'));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('treats an unexpected body as a transient upstream error', async () => {
    fetchMock.mockResolvedValue(Response.json({ token: 'only-one' }));

    const error = await rejection(refreshTokens('refresh-1'));

    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ code: 'UPSTREAM_ERROR' });
    expect(pendingRefreshCount()).toBe(0);
  });
});

describe('refreshSessionStore', () => {
  const session = { accessToken: 'access-1', refreshToken: 'refresh-1' };

  it('stores the new pair', async () => {
    respondWithPairs();
    const store = createMemorySessionStore(session);

    const tokens = await refreshSessionStore(store);

    expect(tokens).toEqual(pairFor('refresh-1'));
    expect(store.get()).toEqual(pairFor('refresh-1'));
  });

  it('clears the store when the refresh is rejected', async () => {
    fetchMock.mockResolvedValue(Response.json({}, { status: 403 }));
    const store = createMemorySessionStore(session);

    const error = await rejection(refreshSessionStore(store));

    expect(error).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(store.get()).toBeNull();
  });

  it.each([
    [
      'a 5xx',
      () => fetchMock.mockResolvedValue(Response.json({}, { status: 503 })),
    ],
    [
      'a network failure',
      () => fetchMock.mockRejectedValue(new TypeError('fetch failed')),
    ],
  ])('keeps the session after %s', async (_case, arrange) => {
    arrange();
    const store = createMemorySessionStore(session);

    const error = await rejection(refreshSessionStore(store));

    expect(error).toMatchObject({ code: 'UPSTREAM_ERROR' });
    expect(store.get()).toEqual(session);
  });

  it('fails without a session and without calling upstream', async () => {
    const error = await rejection(
      refreshSessionStore(createMemorySessionStore()),
    );

    expect(error).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
