import { AdminModulePage } from '@/components/admin/AdminModulePage';

export const metadata = {
  title: 'Subscriptions - Admin',
  description: 'Manage organization subscriptions.',
};

export default function SubscriptionsPage() {
  return (
    <AdminModulePage
      module="subscriptions"
      title="Subscriptions"
      description="Organization subscription records."
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'status', label: 'Status' },
        { key: 'created_at', label: 'Created' },
      ]}
      emptyState={{
        title: 'No subscriptions',
        description: 'No subscription records found.',
      }}
    />
  );
}


