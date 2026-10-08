import Image from 'next/image';

import type { UserDto } from '../model/user';

export function UserBadge({ user }: { user: UserDto }) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src={user.image}
        alt=""
        width={40}
        height={40}
        className="size-10 rounded-full bg-zinc-200"
      />
      <div className="leading-tight">
        <p className="text-sm font-medium">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-xs text-zinc-500">
          @{user.username} · {user.email}
        </p>
      </div>
    </div>
  );
}
