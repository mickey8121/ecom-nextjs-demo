'use client';

import { type FormEvent, useState } from 'react';

import { toUserMessage } from '@/shared/api';
import { Alert, Button } from '@/shared/ui';

import { submitLogin } from '../model/submit';

const inputClassName =
  'rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900';

export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    try {
      await submitLogin({
        username: String(data.get('username') ?? ''),
        password: String(data.get('password') ?? ''),
      });
    } catch (submitError) {
      setError(toUserMessage(submitError));
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <Alert variant="error">{error}</Alert>}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Username
        <input
          name="username"
          autoComplete="username"
          required
          className={inputClassName}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClassName}
        />
      </label>
      <Button type="submit" pending={pending}>
        Log in
      </Button>
      <p className="text-xs text-zinc-500">
        Test account: <code>emilys</code> / <code>emilyspass</code>. Any
        DummyJSON user works.
      </p>
    </form>
  );
}
