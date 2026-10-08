import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemoryStorage } from '@/test/memory-storage';

import { clearSessionData } from './session-data';

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, 'sessionStorage');
});

describe('clearSessionData', () => {
  it('removes only keys with the ecom: prefix', () => {
    const storage = new MemoryStorage();
    storage.setItem('ecom:carts:1', '[]');
    storage.setItem('ecom:carts:2', '[]');
    storage.setItem('theme', 'dark');
    storage.setItem('other:ecom:key', 'kept');
    vi.stubGlobal('sessionStorage', storage);

    clearSessionData();

    expect(storage.keys()).toEqual(['theme', 'other:ecom:key']);
  });

  it('does nothing without storage', () => {
    expect(() => clearSessionData()).not.toThrow();
  });

  it('does nothing when storage access is blocked', () => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('Access denied', 'SecurityError');
      },
    });

    expect(() => clearSessionData()).not.toThrow();
  });
});
