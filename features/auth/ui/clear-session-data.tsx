'use client';

import { useEffect } from 'react';

import { clearSessionData } from '@/shared/lib';

export function ClearSessionData() {
  useEffect(() => {
    clearSessionData();
  }, []);

  return null;
}
