import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Email activity - Admin',
  description: 'The event stream behind sending metrics.',
};

export default function Page() {
  return <AdminModuleRoute module="email-activity" />;
}
