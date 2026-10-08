import * as z from 'zod';

import { login } from '@/features/auth/index.server';
import {
  createRouteHandlerSessionStore,
  parseJsonBody,
  toErrorResponse,
} from '@/shared/api/index.server';

export const maxDuration = 30;

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const credentials = await parseJsonBody(request, credentialsSchema);
    const user = await login(
      await createRouteHandlerSessionStore(),
      credentials,
    );
    return Response.json({ user });
  } catch (error) {
    return toErrorResponse(error);
  }
}
