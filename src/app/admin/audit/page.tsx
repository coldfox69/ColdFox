import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Audit log - Admin',
  description: 'Administrative changes with actor and metadata.',
};

export default function Page() {
  return <AdminModuleRoute module="audit" />;
}
