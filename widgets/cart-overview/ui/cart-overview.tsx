import { CartCard, type CartDto } from '@/entities/cart';

export function CartOverview({ carts }: { carts: CartDto[] }) {
  if (carts.length === 0) {
    return <p className="text-sm text-zinc-500">You have no carts yet.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {carts.map((cart) => (
        <CartCard key={cart.id} cart={cart} />
      ))}
    </div>
  );
}
