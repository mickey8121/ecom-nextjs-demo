import { describe, expect, it } from 'vitest';

import { formatPrice } from './format';

describe('formatPrice', () => {
  it('formats US dollars with cents', () => {
    expect(formatPrice(9.99)).toBe('$9.99');
    expect(formatPrice(3999.99)).toBe('$3,999.99');
    expect(formatPrice(18)).toBe('$18.00');
  });
});
