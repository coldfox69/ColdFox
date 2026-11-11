import { AdminOverview } from '@/components/admin/AdminOverview';

export const metadata = {
  title: 'Overview - Admin',
  description: 'Platform-wide metrics from live database records.',
};

export default function OverviewPage() {
  return <AdminOverview />;
}
