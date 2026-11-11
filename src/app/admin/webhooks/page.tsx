import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Webhooks - Admin',
  description: 'Inbound provider events and signature state.',
};

export default function Page() {
  return <AdminModuleRoute module="webhooks" />;
}
