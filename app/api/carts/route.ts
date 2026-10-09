import * as z from 'zod';

import { addCart } from '@/entities/cart/index.server';
import {
  createAuthenticatedClient,
  createRouteHandlerSessionStore,
  parseJsonBody,
  toErrorResponse,
} from '@/shared/api/index.server';

export const maxDuration = 30;

const bodySchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(10).default(1),
});

export async function POST(request: Request) {
  try {
    const { productId, quantity } = await parseJsonBody(request, bodySchema);
    const client = createAuthenticatedClient(
      await createRouteHandlerSessionStore(),
    );
    const cart = await addCart(client, client.userId(), [
      { productId, quantity },
    ]);
    return Response.json({ cart }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
