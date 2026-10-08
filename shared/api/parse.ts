import 'server-only';

import type * as z from 'zod';

import { AppError } from './errors';

export async function parseJsonBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<z.output<Schema>> {
  if (!isJsonContentType(request.headers.get('content-type'))) {
    throw new AppError('VALIDATION_ERROR');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    throw new AppError('VALIDATION_ERROR', { cause: error });
  }

  return parseWith(schema, body);
}

export function parseQuery<Schema extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: Schema,
): z.output<Schema> {
  return parseWith(schema, Object.fromEntries(searchParams));
}

function parseWith<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', { cause: result.error });
  }
  return result.data;
}

function isJsonContentType(contentType: string | null) {
  const mediaType = contentType?.split(';')[0]?.trim().toLowerCase();
  return mediaType === 'application/json';
}
