import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Billing - Admin',
  description: 'Invoice records and administrative status.',
};

export default function Page() {
  return <AdminModuleRoute module="billing" />;
}
