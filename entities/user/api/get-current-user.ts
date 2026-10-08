import 'server-only';

import { cache } from 'react';

import type { AuthenticatedClient } from '@/shared/api/index.server';

import { toUserDto, type UserDto } from '../model/user';

// React cache keys by argument identity: one render shares this call only through one client instance.
export const getCurrentUser = cache(
  async (client: AuthenticatedClient): Promise<UserDto> =>
    toUserDto(
      await client.request<UserDto & Record<string, unknown>>({
        path: '/auth/me',
      }),
    ),
);
