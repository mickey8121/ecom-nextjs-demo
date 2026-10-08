import type { NextRequest } from 'next/server';
import * as z from 'zod';

import { getProducts } from '@/entities/product/index.server';
import {
  createAuthenticatedClient,
  createRouteHandlerSessionStore,
  parseQuery,
  toErrorResponse,
} from '@/shared/api/index.server';
import { PRODUCTS_PAGE_SIZE } from '@/shared/config';

export const maxDuration = 30;

const querySchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(30).default(PRODUCTS_PAGE_SIZE),
});

export async function GET(request: NextRequest) {
  try {
    const query = parseQuery(request.nextUrl.searchParams, querySchema);
    const client = createAuthenticatedClient(
      await createRouteHandlerSessionStore(),
    );
    return Response.json(await getProducts(client, query));
  } catch (error) {
    return toErrorResponse(error);
  }
}
