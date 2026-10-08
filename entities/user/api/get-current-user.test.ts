import { describe, expect, it } from 'vitest';

import { mockAuthenticatedClient } from '@/test/authenticated-client';

import { getCurrentUser } from './get-current-user';

describe('getCurrentUser', () => {
  it('requests /auth/me and maps the user', async () => {
    const { client, request } = mockAuthenticatedClient({
      id: 1,
      username: 'emilys',
      firstName: 'Emily',
      lastName: 'Johnson',
      email: 'emily.johnson@x.dummyjson.com',
      image: 'https://dummyjson.com/icon/emilys/128',
      password: 'emilyspass',
    });

    const user = await getCurrentUser(client);

    expect(request).toHaveBeenCalledExactlyOnceWith({ path: '/auth/me' });
    expect(user).not.toHaveProperty('password');
    expect(user.username).toBe('emilys');
  });
});
