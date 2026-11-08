import { AdminModulePage } from '@/components/admin/AdminModulePage';
import { Ticket } from 'lucide-react';

export const metadata = {
  title: 'Support Tickets — Admin',
  description: 'Cross-organization support tickets.',
};

export default function TicketsPage() {
  return (
    <AdminModulePage
      module="tickets"
      title="Support Tickets"
      description="All support tickets across organizations."
      icon={Ticket}
      columns={[
        { key: 'id', label: 'Ticket ID' },
        { key: 'subject', label: 'Subject' },
        { key: 'status', label: 'Status' },
        { key: 'priority', label: 'Priority' },
        { key: 'created_at', label: 'Created' },
      ]}
      emptyState={{
        title: 'No tickets',
        description: 'No support tickets have been created yet.',
      }}
    />
  );
}


