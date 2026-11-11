import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Announcements - Admin',
  description: 'In-product banner messages.',
};

export default function Page() {
  return <AdminModuleRoute module="announcements" />;
}
