import type { UserDto } from '@/entities/user';
import { bffRequest } from '@/shared/api';
import { clearSessionData, navigateFullPage } from '@/shared/lib';

import type { Credentials } from './credentials';

export async function submitLogin(credentials: Credentials) {
  await bffRequest<{ user: UserDto }>('/api/auth/login', {
    method: 'POST',
    body: credentials,
  });
  navigateFullPage('/dashboard');
}

export async function submitLogout() {
  await bffRequest<void>('/api/auth/logout', { method: 'POST' });
  clearSessionData();
  navigateFullPage('/login');
}
