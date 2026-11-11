import { AdminSystemHealth } from '@/components/admin/AdminSystemHealth';

export const metadata = {
  title: 'System health - Admin',
  description: 'Queue, mailbox and integration health.',
};

export default function SystemHealthPage() {
  return <AdminSystemHealth />;
}
