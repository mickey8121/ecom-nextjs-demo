import 'server-only';

import * as z from 'zod';

import { ACCESS_TOKEN_TTL_MINUTES } from '@/shared/config';

import { AppError } from '../errors';
import { UpstreamError, upstreamRequest } from '../upstream';
import type { SessionStore, TokenPair } from './store';

const tokenPairSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

// Keyed by refresh token: concurrent callers of one session share a refresh, other sessions never do.
const inFlight = new Map<string, Promise<TokenPair>>();

export function refreshTokens(refreshToken: string): Promise<TokenPair> {
  const pending = inFlight.get(refreshToken);
  if (pending) return pending;

  const refresh = requestTokenPair(refreshToken).finally(() => {
    inFlight.delete(refreshToken);
  });
  inFlight.set(refreshToken, refresh);
  return refresh;
}

export function pendingRefreshCount() {
  return inFlight.size;
}

export async function refreshSessionStore(
  store: SessionStore,
): Promise<TokenPair> {
  const session = store.get();
  if (!session) throw new AppError('UNAUTHENTICATED');

  try {
    const tokens = await refreshTokens(session.refreshToken);
    store.set(tokens);
    return tokens;
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') {
      store.clear();
    }
    throw error;
  }
}

async function requestTokenPair(refreshToken: string): Promise<TokenPair> {
  let payload: unknown;
  try {
    payload = await upstreamRequest<unknown>({
      path: '/auth/refresh',
      method: 'POST',
      body: { refreshToken, expiresInMins: ACCESS_TOKEN_TTL_MINUTES },
    });
  } catch (error) {
    if (isRejection(error))
      throw new AppError('UNAUTHENTICATED', { cause: error });
    throw error;
  }

  const result = tokenPairSchema.safeParse(payload);
  if (!result.success) {
    console.error('upstream refresh returned an unexpected body');
    throw new UpstreamError('UPSTREAM_ERROR', 200, { cause: result.error });
  }
  return result.data;
}

function isRejection(error: unknown) {
  return (
    error instanceof UpstreamError &&
    (error.upstreamStatus === 401 || error.upstreamStatus === 403)
  );
}
