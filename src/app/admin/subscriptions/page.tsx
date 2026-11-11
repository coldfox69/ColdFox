import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Subscriptions - Admin',
  description: 'Plan state for every workspace.',
};

export default function Page() {
  return <AdminModuleRoute module="subscriptions" />;
}
