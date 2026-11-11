import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Feature flags - Admin',
  description: 'Server-side release switches.',
};

export default function Page() {
  return <AdminModuleRoute module="feature-flags" />;
}
