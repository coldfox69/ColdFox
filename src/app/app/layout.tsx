import { getNotifications } from '@/lib/data/app';
import { requireOrganization } from '@/lib/auth/context';
import { AppLayout } from '@/components/layout/AppLayout';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard - ColdFox',
  description: 'Your ColdFox workspace dashboard.',
};

// Temporary: marks when this module was first loaded.
const MODULE_LOADED_AT = Date.now();

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const renderStart = Date.now();
  console.log(`[render] layout module->render ${renderStart - MODULE_LOADED_AT}ms uptime=${Math.round(process.uptime() * 1000)}ms`);

  const t0 = Date.now();
  const ctx = await requireOrganization();
  console.log(`[render] requireOrganization ${Date.now() - t0}ms`);

  const t1 = Date.now();
  const notifications = await getNotifications(ctx.user.id);
  console.log(`[render] getNotifications ${Date.now() - t1}ms`);

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
