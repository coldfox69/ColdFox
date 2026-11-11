import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Plans - Admin',
  description: 'The plan catalog used by onboarding and checkout.',
};

export default function Page() {
  return <AdminModuleRoute module="plans" />;
}
