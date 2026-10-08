import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import { toErrorResponse } from './bff-response';
import { AppError, ERROR_CATALOG } from './errors';
import { parseJsonBody, parseQuery } from './parse';

const bodySchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(10).default(1),
});

const querySchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(30).default(5),
});

function jsonRequest(body: string, contentType = 'application/json') {
  return new Request('http://localhost/api/carts', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });
}

async function validationFailure(parse: () => unknown) {
  let error: unknown;
  try {
    await parse();
  } catch (reason) {
    error = reason;
  }
  if (!(error instanceof AppError)) {
    throw new Error('Expected parsing to fail with an AppError');
  }
  return error;
}

const validationBody = {
  error: {
    code: 'VALIDATION_ERROR',
    message: ERROR_CATALOG.VALIDATION_ERROR.message,
  },
};

describe('parseJsonBody', () => {
  it('returns the parsed body with defaults applied', async () => {
    const body = await parseJsonBody(
      jsonRequest('{"productId":3}', 'application/json; charset=utf-8'),
      bodySchema,
    );

    expect(body).toEqual({ productId: 3, quantity: 1 });
  });

  it('rejects an invalid body without zod messages', async () => {
    const error = await validationFailure(() =>
      parseJsonBody(jsonRequest('{"productId":"three"}'), bodySchema),
    );

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe(ERROR_CATALOG.VALIDATION_ERROR.message);
    expect(await toErrorResponse(error).json()).toEqual(validationBody);
  });

  it('rejects malformed JSON', async () => {
    const error = await validationFailure(() =>
      parseJsonBody(jsonRequest('{"productId":'), bodySchema),
    );

    expect(await toErrorResponse(error).json()).toEqual(validationBody);
  });

  it.each(['text/plain', 'application/x-www-form-urlencoded', ''])(
    'rejects a body sent as "%s"',
    async (contentType) => {
      const error = await validationFailure(() =>
        parseJsonBody(jsonRequest('{"productId":3}', contentType), bodySchema),
      );

      expect(error.code).toBe('VALIDATION_ERROR');
    },
  );
});

describe('parseQuery', () => {
  it('returns the parsed query', () => {
    const query = parseQuery(new URLSearchParams('skip=10'), querySchema);

    expect(query).toEqual({ skip: 10, limit: 5 });
  });

  it('rejects an invalid query without zod messages', async () => {
    const error = await validationFailure(() =>
      parseQuery(new URLSearchParams('limit=500'), querySchema),
    );

    expect(await toErrorResponse(error).json()).toEqual(validationBody);
  });
});
