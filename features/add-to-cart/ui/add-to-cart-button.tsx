'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { useCartStore } from '@/entities/cart';
import { toUserMessage } from '@/shared/api';
import { Button } from '@/shared/ui';

import { submitAddToCart } from '../api/submit-add-to-cart';

export function AddToCartButton({ productId }: { productId: number }) {
  const addToCart = useCartStore((state) => state.addToCart);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const cart = await submitAddToCart(productId);
      addToCart(cart);
      toast.success(`Added to cart #${cart.id}`);
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button className="w-full" pending={pending} onClick={handleClick}>
      Add to cart
    </Button>
  );
}
