import { AdminModulePage } from '@/components/admin/AdminModulePage';
import { Flag } from 'lucide-react';

export const metadata = {
  title: 'Abuse Monitoring - Admin',
  description: 'Spam complaints and bounces.',
};

export default function AbusePage() {
  return (
    <AdminModulePage
      module="abuse"
      title="Abuse Monitoring"
      description="Spam complaints and bounce records."
      icon={Flag}
      columns={[
        { key: 'complaints', label: 'Complaints' },
        { key: 'bounces', label: 'Bounces' },
      ]}
      emptyState={{
        title: 'No abuse records',
        description: 'No spam complaints or bounces recorded.',
      }}
    />
  );
}


