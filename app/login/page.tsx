import type { Metadata } from 'next';
import { Suspense } from 'react';

import {
  ClearSessionData,
  LoginForm,
  SessionExpiredNotice,
} from '@/features/auth';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Log in</h1>
        <ClearSessionData />
        <Suspense>
          <SessionExpiredNotice />
        </Suspense>
        <LoginForm />
      </div>
    </main>
  );
}
