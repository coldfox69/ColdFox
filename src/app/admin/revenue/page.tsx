import { AdminRevenue } from '@/components/admin/AdminRevenue';

export const metadata = {
  title: 'Revenue - Admin',
  description: 'Recurring revenue, paid invoices and plan value.',
};

export default function RevenuePage() {
  return <AdminRevenue />;
}
