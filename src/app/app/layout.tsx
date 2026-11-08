import { getNotifications } from '@/lib/data/app';
import { requireOrganization } from '@/lib/auth/context';
import { AppLayout } from '@/components/layout/AppLayout';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard — ColdFox',
  description: 'Your ColdFox workspace dashboard.',
};

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireOrganization();
  const notifications = await getNotifications(ctx.user.id);

  return (
    <AppLayout
      user={ctx.user}
      organization={ctx.organization}
      notifications={notifications}
      isPlatformAdmin={ctx.isPlatformAdmin}
    >
      {children}
    </AppLayout>
  );
}
