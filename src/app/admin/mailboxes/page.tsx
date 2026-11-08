import { AdminModulePage } from '@/components/admin/AdminModulePage';
import { Mail } from 'lucide-react';

export const metadata = {
  title: 'Mailboxes — Admin',
  description: 'Cross-organization mailbox status.',
};

export default function MailboxesPage() {
  return (
    <AdminModulePage
      module="mailboxes"
      title="Mailboxes"
      description="All connected mailboxes across organizations."
      icon={Mail}
      columns={[
        { key: 'id', label: 'Mailbox ID' },
        { key: 'email_address', label: 'Email' },
        { key: 'provider', label: 'Provider' },
        { key: 'status', label: 'Status' },
        { key: 'daily_limit', label: 'Daily Limit' },
        { key: 'sent_today', label: 'Sent Today' },
        { key: 'reputation', label: 'Reputation' },
      ]}
      emptyState={{
        title: 'No mailboxes',
        description: 'No mailboxes have been connected yet.',
      }}
    />
  );
}


