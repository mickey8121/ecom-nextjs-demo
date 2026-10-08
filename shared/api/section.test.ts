import { describe, expect, it } from 'vitest';

import { AppError, ERROR_CATALOG } from './errors';
import { loadSection } from './section';
import { UpstreamError } from './upstream';

async function thrownBy(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('Expected loadSection to throw');
    },
    (reason: unknown) => reason,
  );
}

describe('loadSection', () => {
  it('returns the data of a successful load', async () => {
    await expect(loadSection(Promise.resolve([1, 2]))).resolves.toEqual({
      ok: true,
      data: [1, 2],
    });
  });

  it.each([
    ['an upstream failure', new UpstreamError('UPSTREAM_ERROR', 500)],
    ['a missing resource', new AppError('NOT_FOUND')],
  ])('turns %s into the catalog message', async (_case, error) => {
    const result = await loadSection(Promise.reject(error));

    expect(result).toEqual({
      ok: false,
      message: ERROR_CATALOG[error.code].message,
    });
  });

  it('redirects to /login?session=expired on UNAUTHENTICATED', async () => {
    const thrown = await thrownBy(
      loadSection(Promise.reject(new AppError('UNAUTHENTICATED'))),
    );

    expect(thrown).toMatchObject({
      digest: expect.stringContaining(';/login?session=expired;'),
    });
  });

  it('rethrows unexpected errors untouched for the error boundary', async () => {
    const unexpected = new TypeError('Cannot read properties of undefined');

    expect(await thrownBy(loadSection(Promise.reject(unexpected)))).toBe(
      unexpected,
    );
  });
});
