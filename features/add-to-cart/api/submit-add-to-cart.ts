import type { CartDto } from '@/entities/cart';
import { bffRequest } from '@/shared/api';

export async function submitAddToCart(productId: number) {
  const { cart } = await bffRequest<{ cart: CartDto }>('/api/carts', {
    method: 'POST',
    body: { productId, quantity: 1 },
  });
  return cart;
}
