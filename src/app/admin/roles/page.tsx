import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Admin accounts - Admin',
  description: 'Console access and role assignments.',
};

export default function Page() {
  return <AdminModuleRoute module="roles" />;
}
