import { vi } from 'vitest';

import type { AuthenticatedClient } from '@/shared/api/index.server';

export function mockAuthenticatedClient(response: unknown, userId = 1) {
  const request = vi.fn(async () => response);
  const client: AuthenticatedClient = {
    request: request as AuthenticatedClient['request'],
    userId: () => userId,
  };
  return { client, request };
}
