import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Campaigns - Admin',
  description: 'Monitor and control customer campaigns.',
};

export default function Page() {
  return <AdminModuleRoute module="campaigns" />;
}
