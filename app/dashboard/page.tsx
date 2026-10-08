import { LogoutButton } from '@/features/auth';

export default function DashboardPage() {
  return (
    <main className="flex items-center justify-between p-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <LogoutButton />
    </main>
  );
}
