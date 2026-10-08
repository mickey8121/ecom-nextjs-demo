import 'server-only';

import { toUserDto, type UserDto } from '@/entities/user';
import { AppError } from '@/shared/api';
import {
  parseTokenPair,
  UpstreamError,
  upstreamRequest,
  type SessionStore,
} from '@/shared/api/index.server';
import { ACCESS_TOKEN_TTL_MINUTES } from '@/shared/config';

import type { Credentials } from '../model/credentials';

export async function login(
  store: SessionStore,
  { username, password }: Credentials,
): Promise<UserDto> {
  let payload: UserDto & Record<string, unknown>;
  try {
    payload = await upstreamRequest({
      path: '/auth/login',
      method: 'POST',
      body: { username, password, expiresInMins: ACCESS_TOKEN_TTL_MINUTES },
    });
  } catch (error) {
    if (error instanceof UpstreamError && error.upstreamStatus === 400) {
      throw new AppError('INVALID_CREDENTIALS', { cause: error });
    }
    throw error;
  }

  store.set(parseTokenPair(payload, '/auth/login'));
  return toUserDto(payload);
}

export function logout(store: SessionStore) {
  store.clear();
}
