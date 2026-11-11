import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Error logs - Admin',
  description: 'Server errors captured by the platform.',
};

export default function Page() {
  return <AdminModuleRoute module="errors" />;
}
