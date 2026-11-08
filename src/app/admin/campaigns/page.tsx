import { AdminModulePage } from '@/components/admin/AdminModulePage';
import { Megaphone } from 'lucide-react';

export const metadata = {
  title: 'Campaigns - Admin',
  description: 'Cross-organization campaign activity.',
};

export default function CampaignsPage() {
  return (
    <AdminModulePage
      module="campaigns"
      title="Campaigns"
      description="All campaigns across organizations."
      icon={Megaphone}
      columns={[
        { key: 'id', label: 'Campaign ID' },
        { key: 'name', label: 'Name' },
        { key: 'status', label: 'Status' },
        { key: 'total_leads', label: 'Leads' },
        { key: 'emails_sent', label: 'Sent' },
        { key: 'replies', label: 'Replies' },
        { key: 'created_at', label: 'Created' },
      ]}
      emptyState={{
        title: 'No campaigns',
        description: 'No campaigns have been created yet.',
      }}
    />
  );
}


