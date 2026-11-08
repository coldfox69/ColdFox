import { getSessionContext } from '@/lib/auth/context';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Admin Panel - ColdFox',
  description: 'ColdFox platform administration.',
};

export default async function AdminShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login?next=/admin');
  if (!ctx.isPlatformAdmin) redirect('/app');

  return (
    <AdminLayout user={ctx.user} role={ctx.adminRole ?? 'admin'}>
      {children}
    </AdminLayout>
  );
}
