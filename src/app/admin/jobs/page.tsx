import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Background jobs - Admin',
  description: 'Queued, running and failed work.',
};

export default function Page() {
  return <AdminModuleRoute module="jobs" />;
}
