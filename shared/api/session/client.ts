import 'server-only';

import { AppError } from '../errors';
import {
  UpstreamError,
  upstreamRequest,
  type UpstreamRequest,
} from '../upstream';
import { readTokenUserId } from './jwt';
import { refreshSessionStore } from './refresh';
import type { SessionStore } from './store';

export type AuthenticatedClient = {
  request<T>(request: Omit<UpstreamRequest, 'token'>): Promise<T>;
  userId(): number;
};

export function createAuthenticatedClient(
  store: SessionStore,
): AuthenticatedClient {
  function endSession(cause: unknown): never {
    store.clear();
    throw new AppError('UNAUTHENTICATED', { cause });
  }

  // A different access token in the store means a concurrent call has already refreshed.
  async function tokenForRetry(failedToken: string | null) {
    const session = store.get();
    if (!session) throw new AppError('UNAUTHENTICATED');
    if (session.accessToken && session.accessToken !== failedToken) {
      return session.accessToken;
    }
    return (await refreshSessionStore(store)).accessToken;
  }

  return {
    async request<T>(request: Omit<UpstreamRequest, 'token'>) {
      const session = store.get();
      if (!session) throw new AppError('UNAUTHENTICATED');

      try {
        return await upstreamRequest<T>({
          ...request,
          token: session.accessToken ?? undefined,
        });
      } catch (error) {
        if (!isUnauthorized(error)) throw error;
      }

      const token = await tokenForRetry(session.accessToken);
      try {
        return await upstreamRequest<T>({ ...request, token });
      } catch (error) {
        if (isUnauthorized(error)) endSession(error);
        throw error;
      }
    },

    userId() {
      const session = store.get();
      if (!session) throw new AppError('UNAUTHENTICATED');

      const fromAccessToken = session.accessToken
        ? readTokenUserId(session.accessToken)
        : null;
      const userId = fromAccessToken ?? readTokenUserId(session.refreshToken);
      if (userId === null) throw new AppError('UNAUTHENTICATED');
      return userId;
    },
  };
}

function isUnauthorized(error: unknown) {
  return error instanceof UpstreamError && error.upstreamStatus === 401;
}
