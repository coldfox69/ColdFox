import { AdminModulePage } from '@/components/admin/AdminModulePage';

export const metadata = {
  title: 'Plans - Admin',
  description: 'Manage subscription plans.',
};

export default function PlansPage() {
  return (
    <AdminModulePage
      module="plans"
      title="Plans"
      description="Available subscription plans."
      columns={[
        { key: 'key', label: 'Plan Key' },
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
      ]}
      emptyState={{
        title: 'No plans',
        description: 'No subscription plans defined.',
      }}
    />
  );
}


