import { AdminModulePage } from '@/components/admin/AdminModulePage';

export const metadata = {
  title: 'API Usage - Admin',
  description: 'Rate limit and API usage records.',
};

export default function ApiUsagePage() {
  return (
    <AdminModulePage
      module="api-usage"
      title="API Usage"
      description="Rate limit records across the platform."
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'window_start', label: 'Window Start' },
        { key: 'created_at', label: 'Created' },
      ]}
      emptyState={{
        title: 'No API usage',
        description: 'No API usage records found.',
      }}
    />
  );
}


