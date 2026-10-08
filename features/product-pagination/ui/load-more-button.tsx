'use client';

import { Button } from '@/shared/ui';

type LoadMoreButtonProps = {
  pending: boolean;
  onClick: () => void;
};

export function LoadMoreButton({ pending, onClick }: LoadMoreButtonProps) {
  return (
    <Button variant="secondary" pending={pending} onClick={onClick}>
      Load more
    </Button>
  );
}
