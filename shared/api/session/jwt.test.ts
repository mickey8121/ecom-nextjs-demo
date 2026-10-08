import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeJwt } from '@/test/jwt';

import {
  decodeJwtPayload,
  isTokenExpired,
  readTokenExpiry,
  readTokenUserId,
} from './jwt';

const NOW_SECONDS = 1_800_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_SECONDS * 1000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('JWT claims', () => {
  it('decodes the payload without verifying the signature', () => {
    const token = makeJwt({ id: 1, username: 'emilys', exp: NOW_SECONDS });

    expect(decodeJwtPayload(token)).toEqual({
      id: 1,
      username: 'emilys',
      exp: NOW_SECONDS,
    });
    expect(readTokenUserId(token)).toBe(1);
    expect(readTokenExpiry(token)).toBe(NOW_SECONDS);
  });

  it.each([
    ['not a token', 'garbage'],
    ['two segments', 'header.payload'],
    ['an invalid payload', 'header.%%%.signature'],
    ['an array payload', makeJwt({}).replace(/\.[^.]+\./, '.W10.')],
    ['an empty payload', 'header..signature'],
  ])('returns null for %s', (_case, token) => {
    expect(decodeJwtPayload(token)).toBeNull();
    expect(readTokenUserId(token)).toBeNull();
  });

  it('ignores claims that are not numbers', () => {
    const token = makeJwt({ id: '1', exp: 'soon' });

    expect(readTokenUserId(token)).toBeNull();
    expect(readTokenExpiry(token)).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('treats a token as valid beyond the 10-second leeway', () => {
    expect(isTokenExpired(makeJwt({ exp: NOW_SECONDS + 11 }))).toBe(false);
  });

  it('treats a token expiring within the leeway as expired', () => {
    expect(isTokenExpired(makeJwt({ exp: NOW_SECONDS + 10 }))).toBe(true);
    expect(isTokenExpired(makeJwt({ exp: NOW_SECONDS - 60 }))).toBe(true);
  });

  it('treats malformed tokens and tokens without exp as expired', () => {
    expect(isTokenExpired('garbage')).toBe(true);
    expect(isTokenExpired(makeJwt({ id: 1 }))).toBe(true);
  });
});
