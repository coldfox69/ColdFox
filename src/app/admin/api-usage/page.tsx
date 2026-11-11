import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'API usage - Admin',
  description: 'Rate limit buckets and request pressure.',
};

export default function Page() {
  return <AdminModuleRoute module="api-usage" />;
}
