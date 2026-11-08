import { AdminModulePage } from '@/components/admin/AdminModulePage';

export const metadata = {
  title: 'Organizations - Admin',
  description: 'Manage tenant organizations.',
};

export default function OrganizationsPage() {
  return (
    <AdminModulePage
      module="organizations"
      title="Organizations"
      description="Tenant organizations and their plans."
      columns={[
        { key: 'id', label: 'Org ID' },
        { key: 'name', label: 'Name' },
        { key: 'slug', label: 'Slug' },
        { key: 'plan_key', label: 'Plan' },
        { key: 'created_at', label: 'Created' },
      ]}
      emptyState={{
        title: 'No organizations',
        description: 'No organizations have been created yet.',
      }}
    />
  );
}


