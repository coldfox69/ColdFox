import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Support tickets - Admin',
  description: 'Customer conversations, priorities and internal notes.',
};

export default function Page() {
  return <AdminModuleRoute module="tickets" />;
}
