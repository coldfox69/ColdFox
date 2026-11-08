import { AdminModulePage } from '@/components/admin/AdminModulePage';

export const metadata = {
  title: 'Feature Flags - Admin',
  description: 'Manage feature flags.',
};

export default function FeatureFlagsPage() {
  return (
    <AdminModulePage
      module="feature-flags"
      title="Feature Flags"
      description="Platform feature flags."
      columns={[
        { key: 'key', label: 'Key' },
        { key: 'enabled', label: 'Enabled' },
        { key: 'updated_at', label: 'Updated' },
      ]}
      emptyState={{
        title: 'No feature flags',
        description: 'No feature flags defined.',
      }}
    />
  );
}


