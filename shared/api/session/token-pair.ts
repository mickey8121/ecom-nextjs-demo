import 'server-only';

import * as z from 'zod';

import { UpstreamError } from '../upstream';
import type { TokenPair } from './store';

const tokenPairSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export function parseTokenPair(payload: unknown, path: string): TokenPair {
  const result = tokenPairSchema.safeParse(payload);
  if (!result.success) {
    console.error('upstream response has no token pair', { path });
    throw new UpstreamError('UPSTREAM_ERROR', 200, { cause: result.error });
  }
  return result.data;
}
