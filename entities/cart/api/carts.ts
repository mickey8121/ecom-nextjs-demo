import 'server-only';

import type { AuthenticatedClient } from '@/shared/api/index.server';

import { toCartDto, type CartDto, type CartPayload } from '../model/cart';

export type NewCartItem = {
  productId: number;
  quantity: number;
};

export async function getUserCarts(
  client: AuthenticatedClient,
  userId: number,
): Promise<CartDto[]> {
  const { carts } = await client.request<{ carts: CartPayload[] }>({
    path: `/auth/carts/user/${userId}`,
  });
  return carts.map(toCartDto);
}

export async function addCart(
  client: AuthenticatedClient,
  userId: number,
  items: NewCartItem[],
): Promise<CartDto> {
  const payload = await client.request<CartPayload>({
    path: '/auth/carts/add',
    method: 'POST',
    body: {
      userId,
      products: items.map(({ productId, quantity }) => ({
        id: productId,
        quantity,
      })),
    },
  });
  return toCartDto(payload);
}
