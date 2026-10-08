export const ERROR_CATALOG = {
  VALIDATION_ERROR: {
    status: 400,
    message: 'Please check the entered data.',
  },
  INVALID_CREDENTIALS: {
    status: 401,
    message: 'Invalid username or password.',
  },
  UNAUTHENTICATED: {
    status: 401,
    message: 'Your session has expired. Please log in again.',
  },
  NOT_FOUND: {
    status: 404,
    message: 'The requested item was not found.',
  },
  UPSTREAM_ERROR: {
    status: 502,
    message: 'The service is temporarily unavailable. Please try again.',
  },
  INTERNAL_ERROR: {
    status: 500,
    message: 'Something went wrong. Please try again.',
  },
  NETWORK_ERROR: {
    status: 0,
    message: 'Network error. Check your connection and try again.',
  },
} as const satisfies Record<string, { status: number; message: string }>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CATALOG, value);
}

type AppErrorOptions = {
  status?: number;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, { status, cause }: AppErrorOptions = {}) {
    super(ERROR_CATALOG[code].message, { cause });
    this.name = 'AppError';
    this.code = code;
    this.status = status ?? ERROR_CATALOG[code].status;
  }
}
