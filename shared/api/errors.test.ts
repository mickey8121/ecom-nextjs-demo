import { describe, expect, it } from 'vitest';

import { AppError, ERROR_CATALOG, isErrorCode } from './errors';

describe('ERROR_CATALOG', () => {
  it.each(Object.entries(ERROR_CATALOG))(
    '%s has a status and a message',
    (_code, { status, message }) => {
      expect(Number.isInteger(status)).toBe(true);
      expect(message.trim()).not.toBe('');
    },
  );
});

describe('AppError', () => {
  it('takes its message and status from the catalog', () => {
    const error = new AppError('NOT_FOUND');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.status).toBe(404);
    expect(error.message).toBe(ERROR_CATALOG.NOT_FOUND.message);
  });

  it('keeps an explicit status', () => {
    expect(new AppError('UPSTREAM_ERROR', { status: 503 }).status).toBe(503);
  });
});

describe('isErrorCode', () => {
  it('accepts catalog codes only', () => {
    expect(isErrorCode('UNAUTHENTICATED')).toBe(true);
    expect(isErrorCode('toString')).toBe(false);
    expect(isErrorCode('unauthenticated')).toBe(false);
    expect(isErrorCode(401)).toBe(false);
  });
});
