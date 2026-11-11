import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Integrations - Admin',
  description: 'Configured services in this environment.',
};

export default function Page() {
  return <AdminModuleRoute module="integrations" />;
}
