import { type NextRequest, NextResponse } from 'next/server';

import { AppError } from '@/shared/api';
import {
  createProxySessionStore,
  isTokenExpired,
  refreshSessionStore,
} from '@/shared/api/index.server';

export async function proxy(request: NextRequest) {
  const session = createProxySessionStore(request);
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === '/login') {
    if (searchParams.get('session') === 'expired') {
      session.clear();
      return session.applyTo(forward(request));
    }
    return session.get() ? redirect('/dashboard', request) : forward(request);
  }

  const tokens = session.get();
  if (!tokens) return redirect('/login', request);
  if (pathname === '/') return redirect('/dashboard', request);

  if (!tokens.accessToken || isTokenExpired(tokens.accessToken)) {
    try {
      await refreshSessionStore(session);
    } catch (error) {
      if (error instanceof AppError && error.code === 'UNAUTHENTICATED') {
        return session.applyTo(redirect('/login', request));
      }
      // A transient failure keeps the session; the render retries through the reactive path.
      return NextResponse.next();
    }
  }

  return session.applyTo(forward(request));
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*'],
};

function forward(request: NextRequest) {
  return NextResponse.next({ request: { headers: request.headers } });
}

function redirect(pathname: string, request: NextRequest) {
  return NextResponse.redirect(new URL(pathname, request.url));
}
