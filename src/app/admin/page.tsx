import { AdminModulePage } from '@/components/admin/AdminModulePage';

export const metadata = {
  title: 'Overview - Admin',
  description: 'Platform-wide metrics.',
};

export default function OverviewPage() {
  return (
    <AdminModulePage
      module="overview"
      title="Platform Overview"
      description="Organization, user, campaign, and support metrics."
      rowsKey="totals"
      columns={[
        { key: 'organizations', label: 'Organizations' },
        { key: 'users', label: 'Users' },
        { key: 'campaigns', label: 'Campaigns' },
        { key: 'emailsAccepted', label: 'Emails Accepted' },
        { key: 'replies', label: 'Replies' },
        { key: 'ticketsOpen', label: 'Open Tickets' },
        { key: 'errorsLast30d', label: 'Errors (30d)' },
      ]}
      emptyState={{
        title: 'No platform data',
        description: 'No organizations or users have been created yet.',
      }}
    />
  );
}


