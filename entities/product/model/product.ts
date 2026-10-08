export type ProductDto = {
  id: number;
  title: string;
  price: number;
  thumbnail: string;
  category: string;
  rating: number;
};

export type ProductPayload = ProductDto & Record<string, unknown>;

export function toProductDto(payload: ProductPayload): ProductDto {
  const { id, title, price, thumbnail, category, rating } = payload;
  return { id, title, price, thumbnail, category, rating };
}
