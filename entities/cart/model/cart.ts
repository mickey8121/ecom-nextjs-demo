export type CartItemDto = {
  id: number;
  title: string;
  price: number;
  quantity: number;
  total: number;
  discountedTotal: number;
  thumbnail: string;
};

export type CartDto = {
  id: number;
  items: CartItemDto[];
  total: number;
  discountedTotal: number;
  totalQuantity: number;
};

type CartItemPayload = Omit<CartItemDto, 'discountedTotal'> &
  Record<string, unknown>;

type CartPayload<TItem> = {
  id: number;
  products: (CartItemPayload & TItem)[];
  total: number;
  discountedTotal: number;
  totalQuantity: number;
} & Record<string, unknown>;

export type UserCartPayload = CartPayload<{ discountedTotal: number }>;

export type AddedCartPayload = CartPayload<{ discountedPrice: number }>;

export function toCartDto(payload: UserCartPayload): CartDto {
  return toDto(payload, (product) => product.discountedTotal);
}

export function toAddedCartDto(payload: AddedCartPayload): CartDto {
  return toDto(payload, (product) => product.discountedPrice);
}

function toDto<TItem>(
  payload: CartPayload<TItem>,
  discountedTotalOf: (product: CartItemPayload & TItem) => number,
): CartDto {
  const { id, products, total, discountedTotal, totalQuantity } = payload;
  return {
    id,
    items: products.map((product) => ({
      id: product.id,
      title: product.title,
      price: product.price,
      quantity: product.quantity,
      total: product.total,
      discountedTotal: discountedTotalOf(product),
      thumbnail: product.thumbnail,
    })),
    total,
    discountedTotal,
    totalQuantity,
  };
}

export function mergeCart(local: CartDto | null, added: CartDto): CartDto {
  if (!local) return added;

  const items = [...local.items];
  for (const item of added.items) {
    const index = items.findIndex(({ id }) => id === item.id);
    if (index === -1) {
      items.push(item);
      continue;
    }
    const line = items[index];
    items[index] = {
      ...line,
      quantity: line.quantity + item.quantity,
      total: roundToCents(line.total + item.total),
      discountedTotal: roundToCents(
        line.discountedTotal + item.discountedTotal,
      ),
    };
  }

  return {
    id: local.id,
    items,
    total: sumOf(items, 'total'),
    discountedTotal: sumOf(items, 'discountedTotal'),
    totalQuantity: sumOf(items, 'quantity'),
  };
}

function sumOf(
  items: CartItemDto[],
  field: 'total' | 'discountedTotal' | 'quantity',
) {
  return roundToCents(items.reduce((sum, item) => sum + item[field], 0));
}

function roundToCents(value: number) {
  return Math.round(value * 100) / 100;
}
