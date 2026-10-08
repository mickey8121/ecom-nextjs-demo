import { SESSION_STORAGE_PREFIX } from '@/shared/config';

export function clearSessionData() {
  try {
    if (typeof sessionStorage === 'undefined') return;

    const keys: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(SESSION_STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Storage can be blocked by browser settings; there is nothing to clear then.
  }
}
