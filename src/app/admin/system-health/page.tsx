import { AdminModulePage } from '@/components/admin/AdminModulePage';

export const metadata = {
  title: 'System Health - Admin',
  description: 'Platform system health.',
};

export default function SystemHealthPage() {
  return (
    <AdminModulePage
      module="system-health"
      title="System Health"
      description="Background jobs, mailboxes, campaigns, and integration health."
      columns={[
        { key: 'jobs', label: 'Jobs' },
        { key: 'mailboxes', label: 'Mailboxes' },
        { key: 'campaigns', label: 'Campaigns' },
        { key: 'errorsLast24h', label: 'Errors (24h)' },
      ]}
      emptyState={{
        title: 'No health data',
        description: 'System health metrics are not available yet.',
      }}
    />
  );
}


