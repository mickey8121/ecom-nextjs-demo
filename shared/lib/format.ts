// A fixed locale keeps server and client output identical, so hydration never mismatches.
const priceFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatPrice(amount: number) {
  return priceFormat.format(amount);
}
