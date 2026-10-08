import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeJwt } from '@/test/jwt';

import { AppError } from '../errors';
import { createAuthenticatedClient } from './client';
import { createMemorySessionStore, type SessionStore } from './store';

const fetchMock = vi.fn<typeof fetch>();
const consoleError = vi.spyOn(console, 'error');

const session = { accessToken: 'access-1', refreshToken: 'refresh-1' };
const refreshedPair = { accessToken: 'access-2', refreshToken: 'refresh-2' };

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  consoleError.mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  consoleError.mockReset();
});

type UpstreamCall = { path: string; token: string | null };

function upstream(respond: (call: UpstreamCall) => Response) {
  fetchMock.mockImplementation(async (input, init) => {
    const authorization = new Headers(init?.headers).get('authorization');
    return respond({
      path: new URL(String(input)).pathname,
      token: authorization?.replace('Bearer ', '') ?? null,
    });
  });
}

function tokensSentTo(path: string) {
  return fetchMock.mock.calls
    .filter(([input]) => new URL(String(input)).pathname === path)
    .map(([, init]) => new Headers(init?.headers).get('authorization'));
}

const ok = () => Response.json({ id: 1 });
const unauthorized = () =>
  Response.json({ message: 'Token Expired!' }, { status: 401 });
const refreshed = () => Response.json(refreshedPair);

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof AppError)) {
    throw new Error('Expected the request to fail with an AppError');
  }
  return error;
}

function getMe(store: SessionStore) {
  return createAuthenticatedClient(store).request<{ id: number }>({
    path: '/auth/me',
  });
}

describe('authenticated client', () => {
  it('fails without a session and without calling upstream', async () => {
    const error = await rejection(getMe(createMemorySessionStore()));

    expect(error.code).toBe('UNAUTHENTICATED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the access token', async () => {
    upstream(ok);

    await expect(getMe(createMemorySessionStore(session))).resolves.toEqual({
      id: 1,
    });
    expect(tokensSentTo('/auth/me')).toEqual(['Bearer access-1']);
    expect(tokensSentTo('/auth/refresh')).toEqual([]);
  });

  it('refreshes on 401 and retries once with the new token', async () => {
    upstream(({ path, token }) => {
      if (path === '/auth/refresh') return refreshed();
      return token === 'access-2' ? ok() : unauthorized();
    });
    const store = createMemorySessionStore(session);

    await expect(getMe(store)).resolves.toEqual({ id: 1 });

    expect(tokensSentTo('/auth/me')).toEqual([
      'Bearer access-1',
      'Bearer access-2',
    ]);
    expect(tokensSentTo('/auth/refresh')).toHaveLength(1);
    expect(store.get()).toEqual(refreshedPair);
  });

  it('sends a request without a token when the access cookie has expired, then refreshes', async () => {
    upstream(({ path, token }) => {
      if (path === '/auth/refresh') return refreshed();
      return token === 'access-2' ? ok() : unauthorized();
    });
    const store = createMemorySessionStore({
      accessToken: null,
      refreshToken: 'refresh-1',
    });

    await expect(getMe(store)).resolves.toEqual({ id: 1 });

    expect(tokensSentTo('/auth/me')).toEqual([null, 'Bearer access-2']);
    expect(tokensSentTo('/auth/refresh')).toHaveLength(1);
  });

  it('retries with a newer token from the store without refreshing', async () => {
    const store = createMemorySessionStore(session);
    upstream(({ token }) => {
      if (token === 'access-2') return ok();
      store.set(refreshedPair);
      return unauthorized();
    });

    await expect(getMe(store)).resolves.toEqual({ id: 1 });

    expect(tokensSentTo('/auth/me')).toEqual([
      'Bearer access-1',
      'Bearer access-2',
    ]);
    expect(tokensSentTo('/auth/refresh')).toEqual([]);
  });

  it('ends the session on a second 401', async () => {
    upstream(({ path }) =>
      path === '/auth/refresh' ? refreshed() : unauthorized(),
    );
    const store = createMemorySessionStore(session);

    const error = await rejection(getMe(store));

    expect(error.code).toBe('UNAUTHENTICATED');
    expect(store.get()).toBeNull();
    expect(tokensSentTo('/auth/me')).toHaveLength(2);
    expect(tokensSentTo('/auth/refresh')).toHaveLength(1);
  });

  it('ends the session when the refresh is rejected', async () => {
    upstream(({ path }) =>
      path === '/auth/refresh'
        ? Response.json({ message: 'Invalid refresh token' }, { status: 403 })
        : unauthorized(),
    );
    const store = createMemorySessionStore(session);

    const error = await rejection(getMe(store));

    expect(error.code).toBe('UNAUTHENTICATED');
    expect(store.get()).toBeNull();
    expect(tokensSentTo('/auth/me')).toHaveLength(1);
  });

  it('keeps the session when the refresh fails for a transient reason', async () => {
    upstream(({ path }) =>
      path === '/auth/refresh'
        ? Response.json({ message: 'Service Unavailable' }, { status: 503 })
        : unauthorized(),
    );
    const store = createMemorySessionStore(session);

    const error = await rejection(getMe(store));

    expect(error.code).toBe('UPSTREAM_ERROR');
    expect(store.get()).toEqual(session);
  });

  it('does not refresh on other upstream errors', async () => {
    upstream(() =>
      Response.json({ message: 'invalid token' }, { status: 500 }),
    );
    const store = createMemorySessionStore(session);

    const error = await rejection(getMe(store));

    expect(error.code).toBe('UPSTREAM_ERROR');
    expect(error.message).not.toContain('invalid token');
    expect(tokensSentTo('/auth/refresh')).toEqual([]);
    expect(store.get()).toEqual(session);
  });

  it('keeps the refreshed session when the retry fails with another error', async () => {
    upstream(({ path, token }) => {
      if (path === '/auth/refresh') return refreshed();
      return token === 'access-2'
        ? Response.json({}, { status: 502 })
        : unauthorized();
    });
    const store = createMemorySessionStore(session);

    const error = await rejection(getMe(store));

    expect(error.code).toBe('UPSTREAM_ERROR');
    expect(store.get()).toEqual(refreshedPair);
  });

  it('refreshes once for concurrent requests of one session', async () => {
    upstream(({ path, token }) => {
      if (path === '/auth/refresh') return refreshed();
      return token === 'access-2' ? ok() : unauthorized();
    });
    const store = createMemorySessionStore(session);

    const results = await Promise.all([
      getMe(store),
      getMe(store),
      getMe(store),
    ]);

    expect(results).toEqual([{ id: 1 }, { id: 1 }, { id: 1 }]);
    expect(tokensSentTo('/auth/refresh')).toHaveLength(1);
  });
});

describe('userId', () => {
  const accessToken = makeJwt({ id: 7 });
  const refreshToken = makeJwt({ id: 8 });

  it('reads the id from the access token', () => {
    const store = createMemorySessionStore({ accessToken, refreshToken });

    expect(createAuthenticatedClient(store).userId()).toBe(7);
  });

  it('falls back to the refresh token when the access token is missing', () => {
    const store = createMemorySessionStore({ accessToken: null, refreshToken });

    expect(createAuthenticatedClient(store).userId()).toBe(8);
  });

  it('fails when no token carries an id', () => {
    const store = createMemorySessionStore({
      accessToken: 'garbage',
      refreshToken: makeJwt({}),
    });

    expect(() => createAuthenticatedClient(store).userId()).toThrow(AppError);
  });

  it('fails without a session', () => {
    expect(() =>
      createAuthenticatedClient(createMemorySessionStore()).userId(),
    ).toThrow(AppError);
  });
});
