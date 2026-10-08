'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { toUserMessage } from '@/shared/api';
import { Button } from '@/shared/ui';

import { submitLogout } from '../model/submit';

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await submitLogout();
    } catch (error) {
      toast.error(toUserMessage(error));
      setPending(false);
    }
  }

  return (
    <Button variant="secondary" pending={pending} onClick={handleClick}>
      Log out
    </Button>
  );
}
