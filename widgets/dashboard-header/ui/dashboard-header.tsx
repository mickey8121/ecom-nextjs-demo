import { UserBadge, type UserDto } from '@/entities/user';
import { LogoutButton } from '@/features/auth';

export function DashboardHeader({ user }: { user: UserDto }) {
  return (
    <header className="flex min-h-18 items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <UserBadge user={user} />
      <LogoutButton />
    </header>
  );
}
