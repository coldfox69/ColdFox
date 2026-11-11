import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Leads - Admin',
  description: 'Cross-workspace lead records and lifecycle status.',
};

export default function Page() {
  return <AdminModuleRoute module="leads" />;
}
