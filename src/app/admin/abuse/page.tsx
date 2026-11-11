import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Deliverability - Admin',
  description: 'Complaints and bounce records.',
};

export default function Page() {
  return <AdminModuleRoute module="abuse" />;
}
