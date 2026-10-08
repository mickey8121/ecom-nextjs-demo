export type CartItemDto = {
  id: number;
  title: string;
  price: number;
  quantity: number;
  total: number;
  thumbnail: string;
};

export type CartDto = {
  id: number;
  items: CartItemDto[];
  total: number;
  discountedTotal: number;
  totalQuantity: number;
};

export type CartPayload = {
  id: number;
  products: (CartItemDto & Record<string, unknown>)[];
  total: number;
  discountedTotal: number;
  totalQuantity: number;
} & Record<string, unknown>;

export function toCartDto(payload: CartPayload): CartDto {
  const { id, products, total, discountedTotal, totalQuantity } = payload;
  return {
    id,
    items: products.map(({ id, title, price, quantity, total, thumbnail }) => ({
      id,
      title,
      price,
      quantity,
      total,
      thumbnail,
    })),
    total,
    discountedTotal,
    totalQuantity,
  };
}
