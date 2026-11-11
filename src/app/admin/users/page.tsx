import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Users - Admin',
  description: 'Search every platform account, review membership and control access.',
};

export default function Page() {
  return <AdminModuleRoute module="users" />;
}
