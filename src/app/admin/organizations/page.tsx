import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Organizations - Admin',
  description: 'Every workspace, its plan and its health.',
};

export default function Page() {
  return <AdminModuleRoute module="organizations" />;
}
