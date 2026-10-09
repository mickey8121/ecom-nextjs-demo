import 'server-only';

import type { AuthenticatedClient } from '@/shared/api/index.server';

import {
  toAddedCartDto,
  toCartDto,
  type AddedCartPayload,
  type CartDto,
  type UserCartPayload,
} from '../model/cart';

export type NewCartItem = {
  productId: number;
  quantity: number;
};

export async function getUserCarts(
  client: AuthenticatedClient,
  userId: number,
): Promise<CartDto[]> {
  const { carts } = await client.request<{ carts: UserCartPayload[] }>({
    path: `/auth/carts/user/${userId}`,
  });
  return carts.map(toCartDto);
}

export async function addCart(
  client: AuthenticatedClient,
  userId: number,
  items: NewCartItem[],
): Promise<CartDto> {
  const payload = await client.request<AddedCartPayload>({
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
  return toAddedCartDto(payload);
}
