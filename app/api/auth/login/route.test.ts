import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ERROR_CATALOG } from '@/shared/api';
import { makeJwt } from '@/test/jwt';
import { FakeCookies, mockCookies } from '@/test/next-headers';

import { POST } from './route';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const NOW_SECONDS = 1_800_000_000;
const accessToken = makeJwt({ id: 1, exp: NOW_SECONDS + 60 });
const refreshToken = makeJwt({ id: 1, exp: NOW_SECONDS + 3600 });
const user = {
  id: 1,
  username: 'emilys',
  firstName: 'Emily',
  lastName: 'Johnson',
  email: 'emily.johnson@x.dummyjson.com',
  image: 'https://dummyjson.com/icon/emilys/128',
};

const fetchMock = vi.fn<typeof fetch>();
const consoleError = vi.spyOn(console, 'error');
let jar: FakeCookies;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW_SECONDS * 1000);
  vi.stubGlobal('fetch', fetchMock);
  consoleError.mockImplementation(() => {});
  jar = new FakeCookies();
  mockCookies(jar);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  consoleError.mockReset();
});

function loginRequest(body: unknown, contentType = 'application/json') {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const credentials = { username: 'emilys', password: 'emilyspass' };

function errorBody(code: keyof typeof ERROR_CATALOG) {
  return { error: { code, message: ERROR_CATALOG[code].message } };
}

describe('POST /api/auth/login', () => {
  it('sets both session cookies and returns the user without tokens', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ ...user, gender: 'female', accessToken, refreshToken }),
    );

    const response = await POST(loginRequest(credentials));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(text)).toEqual({ user });
    for (const forbidden of [
      accessToken,
      refreshToken,
      'accessToken',
      'refreshToken',
    ]) {
      expect(text).not.toContain(forbidden);
    }

    const cookie = {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
    };
    expect(jar.writes).toEqual([
      {
        name: 'ecom_access',
        value: accessToken,
        options: { ...cookie, maxAge: 60 },
      },
      {
        name: 'ecom_refresh',
        value: refreshToken,
        options: { ...cookie, maxAge: 3600 },
      },
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(String(url)).pathname).toBe('/auth/login');
    expect(JSON.parse(String(init?.body))).toEqual({
      ...credentials,
      expiresInMins: 1,
    });
  });

  it('maps rejected credentials to INVALID_CREDENTIALS', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: 'Invalid credentials' }, { status: 400 }),
    );

    const response = await POST(loginRequest(credentials));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual(errorBody('INVALID_CREDENTIALS'));
    expect(jar.writes).toEqual([]);
  });

  it.each([
    ['a missing password', { username: 'emilys' }, 'application/json'],
    [
      'an empty username',
      { username: '  ', password: 'x' },
      'application/json',
    ],
    ['a non-JSON body', '{"username":', 'application/json'],
    [
      'a form-encoded body',
      'username=emilys&password=x',
      'application/x-www-form-urlencoded',
    ],
  ])('rejects %s with VALIDATION_ERROR', async (_case, body, contentType) => {
    const response = await POST(loginRequest(body, contentType));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(errorBody('VALIDATION_ERROR'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an upstream failure to UPSTREAM_ERROR without its text', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: 'database is down' }, { status: 500 }),
    );

    const response = await POST(loginRequest(credentials));
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(JSON.parse(text)).toEqual(errorBody('UPSTREAM_ERROR'));
    expect(text).not.toContain('database is down');
  });

  it('rejects an upstream response without tokens', async () => {
    fetchMock.mockResolvedValue(Response.json(user));

    const response = await POST(loginRequest(credentials));

    expect(response.status).toBe(502);
    expect(jar.writes).toEqual([]);
  });
});
