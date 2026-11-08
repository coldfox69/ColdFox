import { AdminModulePage } from '@/components/admin/AdminModulePage';
import { Activity } from 'lucide-react';

export const metadata = {
  title: 'Email Activity - Admin',
  description: 'Platform-wide email events.',
};

export default function EmailActivityPage() {
  return (
    <AdminModulePage
      module="email-activity"
      title="Email Activity"
      description="Platform-wide email send and delivery events."
      icon={Activity}
      columns={[
        { key: 'id', label: 'Event ID' },
        { key: 'event_type', label: 'Event Type' },
        { key: 'occurred_at', label: 'Occurred At' },
        { key: 'campaign_id', label: 'Campaign ID' },
      ]}
      emptyState={{
        title: 'No email activity',
        description: 'No email events have been recorded yet.',
      }}
    />
  );
}


