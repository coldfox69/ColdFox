import { AdminModulePage } from '@/components/admin/AdminModulePage';
import { Plug } from 'lucide-react';

export const metadata = {
  title: 'Integrations - Admin',
  description: 'Integration configuration status.',
};

export default function IntegrationsPage() {
  return (
    <AdminModulePage
      module="integrations"
      title="Integrations"
      description="Third-party integration configuration status."
      icon={Plug}
      columns={[
        { key: 'key', label: 'Integration' },
        { key: 'label', label: 'Label' },
        { key: 'configured', label: 'Configured' },
        { key: 'detail', label: 'Detail' },
      ]}
      emptyState={{
        title: 'No integrations',
        description: 'No integration records found.',
      }}
    />
  );
}


