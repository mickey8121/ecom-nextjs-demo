import 'server-only';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type SessionTokens = {
  accessToken: string | null;
  refreshToken: string;
};

export interface SessionStore {
  get(): SessionTokens | null;
  set(tokens: TokenPair): void;
  clear(): void;
}

type SessionPersistence = {
  write(tokens: TokenPair): void;
  erase(): void;
};

export function createSessionStore(
  initial: SessionTokens | null,
  persistence?: SessionPersistence,
): SessionStore {
  let current = initial;

  return {
    get: () => current,
    set(tokens) {
      current = { ...tokens };
      persistence?.write(tokens);
    },
    clear() {
      current = null;
      persistence?.erase();
    },
  };
}

export function createMemorySessionStore(initial: SessionTokens | null = null) {
  return createSessionStore(initial);
}
