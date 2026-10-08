import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorResponse, toErrorResponse } from './bff-response';
import { AppError, ERROR_CATALOG } from './errors';
import { UpstreamError } from './upstream';

const consoleError = vi.spyOn(console, 'error');

beforeEach(() => {
  consoleError.mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockReset();
});

describe('errorResponse', () => {
  it('returns the catalog code, message and status', async () => {
    const response = errorResponse('INVALID_CREDENTIALS');

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: ERROR_CATALOG.INVALID_CREDENTIALS.message,
      },
    });
  });
});

describe('toErrorResponse', () => {
  it('maps an AppError to its code', async () => {
    const response = toErrorResponse(new AppError('VALIDATION_ERROR'));

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('maps an UpstreamError to its catalog status, not the upstream one', async () => {
    const response = toErrorResponse(new UpstreamError('UPSTREAM_ERROR', 500));

    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe('UPSTREAM_ERROR');
  });

  it('maps an unknown exception to INTERNAL_ERROR and logs it', async () => {
    const exception = new Error('connection string postgres://secret');

    const response = toErrorResponse(exception);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: ERROR_CATALOG.INTERNAL_ERROR.message,
      },
    });
    expect(consoleError).toHaveBeenCalledWith(
      'unexpected route handler error',
      exception,
    );
  });

  it('maps a thrown non-error value to INTERNAL_ERROR', () => {
    expect(toErrorResponse('boom').status).toBe(500);
  });

  it('rethrows Next.js control flow errors', () => {
    let redirectError: unknown;
    try {
      redirect('/login');
    } catch (error) {
      redirectError = error;
    }

    expect(() => toErrorResponse(redirectError)).toThrow();
  });
});
