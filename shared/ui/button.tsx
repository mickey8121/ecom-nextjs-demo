import type { ComponentProps } from 'react';

import { cx } from './cx';
import { Spinner } from './spinner';

type ButtonVariant = 'primary' | 'secondary';

type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  pending?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-700',
  secondary: 'border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100',
};

export function Button({
  variant = 'primary',
  pending = false,
  disabled,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}
