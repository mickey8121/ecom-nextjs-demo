import { describe, expect, it, vi } from 'vitest';

import { FakeCookies, mockCookies } from '@/test/next-headers';

import { POST } from './route';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

describe('POST /api/auth/logout', () => {
  it('clears both session cookies', async () => {
    const jar = new FakeCookies({
      ecom_access: 'access',
      ecom_refresh: 'refresh',
    });
    mockCookies(jar);

    const response = await POST();

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(jar.deletions).toEqual(['ecom_access', 'ecom_refresh']);
  });

  it('is idempotent without a session', async () => {
    const jar = new FakeCookies();
    mockCookies(jar);

    const response = await POST();

    expect(response.status).toBe(204);
    expect(jar.deletions).toEqual(['ecom_access', 'ecom_refresh']);
  });
});
