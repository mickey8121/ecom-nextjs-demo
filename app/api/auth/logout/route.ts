import { logout } from '@/features/auth/index.server';
import {
  createRouteHandlerSessionStore,
  toErrorResponse,
} from '@/shared/api/index.server';

export const maxDuration = 30;

export async function POST() {
  try {
    logout(await createRouteHandlerSessionStore());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
