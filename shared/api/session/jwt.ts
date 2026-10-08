import 'server-only';

import { REFRESH_LEEWAY_SECONDS } from '@/shared/config';

type JwtPayload = Record<string, unknown>;

export function decodeJwtPayload(token: string): JwtPayload | null {
  const segments = token.split('.');
  if (segments.length !== 3 || !segments[1]) return null;

  try {
    const payload: unknown = JSON.parse(
      Buffer.from(segments[1], 'base64url').toString('utf8'),
    );
    if (typeof payload !== 'object' || payload === null) return null;
    if (Array.isArray(payload)) return null;
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export function readTokenExpiry(token: string) {
  return readNumericClaim(token, 'exp');
}

export function readTokenUserId(token: string) {
  return readNumericClaim(token, 'id');
}

export function isTokenExpired(token: string) {
  const expiry = readTokenExpiry(token);
  if (expiry === null) return true;
  return expiry - REFRESH_LEEWAY_SECONDS <= Date.now() / 1000;
}

function readNumericClaim(token: string, claim: string) {
  const value = decodeJwtPayload(token)?.[claim];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
