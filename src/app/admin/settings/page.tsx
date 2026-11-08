import { AdminModulePage } from '@/components/admin/AdminModulePage';
import { Settings } from 'lucide-react';

export const metadata = {
  title: 'Global Settings — Admin',
  description: 'Manage system settings.',
};

export default function SettingsPage() {
  return (
    <AdminModulePage
      module="settings"
      title="Global Settings"
      description="System-wide configuration settings."
      icon={Settings}
      columns={[
        { key: 'key', label: 'Key' },
        { key: 'value', label: 'Value' },
        { key: 'is_public', label: 'Public' },
        { key: 'updated_at', label: 'Updated' },
      ]}
      emptyState={{
        title: 'No settings',
        description: 'No system settings defined.',
      }}
    />
  );
}


