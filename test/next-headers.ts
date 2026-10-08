import { cookies } from 'next/headers';
import { vi } from 'vitest';

type CookieWrite = {
  name: string;
  value: string;
  options: Record<string, unknown> | undefined;
};

export class FakeCookies {
  readonly #values = new Map<string, string>();
  readonly writes: CookieWrite[] = [];
  readonly deletions: string[] = [];

  constructor(initial: Record<string, string> = {}) {
    for (const [name, value] of Object.entries(initial)) {
      this.#values.set(name, value);
    }
  }

  get(name: string) {
    const value = this.#values.get(name);
    return value === undefined ? undefined : { name, value };
  }

  getAll() {
    return [...this.#values].map(([name, value]) => ({ name, value }));
  }

  has(name: string) {
    return this.#values.has(name);
  }

  set(name: string, value: string, options?: Record<string, unknown>) {
    this.#values.set(name, value);
    this.writes.push({ name, value, options });
    return this;
  }

  delete(name: string) {
    this.#values.delete(name);
    this.deletions.push(name);
    return this;
  }
}

/** Requires `vi.mock('next/headers', () => ({ cookies: vi.fn() }))` in the test file. */
export function mockCookies(jar: FakeCookies) {
  vi.mocked(cookies).mockResolvedValue(
    jar as unknown as Awaited<ReturnType<typeof cookies>>,
  );
}
