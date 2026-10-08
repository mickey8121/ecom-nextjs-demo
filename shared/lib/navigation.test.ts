import { afterEach, describe, expect, it, vi } from 'vitest';

import { navigateFullPage } from './navigation';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('navigateFullPage', () => {
  it('loads the path as a new document', () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });

    navigateFullPage('/login');

    expect(assign).toHaveBeenCalledExactlyOnceWith('/login');
  });

  it('does nothing outside the browser', () => {
    expect(() => navigateFullPage('/login')).not.toThrow();
  });
});
