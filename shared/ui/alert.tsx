import type { ReactNode } from 'react';

import { cx } from './cx';

type AlertVariant = 'error' | 'info';

type AlertProps = {
  variant?: AlertVariant;
  className?: string;
  children: ReactNode;
};

const variantClasses: Record<AlertVariant, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
};

export function Alert({ variant = 'info', className, children }: AlertProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cx(
        'rounded-md border px-4 py-3 text-sm',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
