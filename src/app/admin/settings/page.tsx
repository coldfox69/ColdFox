import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Global settings - Admin',
  description: 'Key value platform settings.',
};

export default function Page() {
  return <AdminModuleRoute module="settings" />;
}
