import { AdminModulePage } from '@/components/admin/AdminModulePage';

export const metadata = {
  title: 'Webhooks - Admin',
  description: 'Webhook event records.',
};

export default function WebhooksPage() {
  return (
    <AdminModulePage
      module="webhooks"
      title="Webhooks"
      description="Incoming webhook event records."
      columns={[
        { key: 'id', label: 'Webhook ID' },
        { key: 'provider', label: 'Provider' },
        { key: 'event_id', label: 'Event ID' },
        { key: 'signature_valid', label: 'Signature Valid' },
        { key: 'received_at', label: 'Received At' },
      ]}
      emptyState={{
        title: 'No webhooks',
        description: 'No webhook events have been received yet.',
      }}
    />
  );
}


