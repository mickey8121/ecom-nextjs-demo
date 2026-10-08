import { cx } from './cx';

type SpinnerProps = {
  label?: string;
  className?: string;
};

export function Spinner({ label, className }: SpinnerProps) {
  const circle = (
    <span
      aria-hidden
      className={cx(
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
    />
  );

  if (!label) return circle;

  return (
    <span role="status" className="inline-flex items-center">
      {circle}
      <span className="sr-only">{label}</span>
    </span>
  );
}
