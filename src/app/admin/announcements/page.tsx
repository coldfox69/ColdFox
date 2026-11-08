import { AdminModulePage } from '@/components/admin/AdminModulePage';
import { Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Announcements - Admin',
  description: 'Platform announcements.',
};

export default function AnnouncementsPage() {
  return (
    <AdminModulePage
      module="announcements"
      title="Announcements"
      description="Platform-wide announcements."
      icon={Sparkles}
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'title', label: 'Title' },
        { key: 'variant', label: 'Variant' },
        { key: 'is_active', label: 'Active' },
        { key: 'created_at', label: 'Created' },
      ]}
      emptyState={{
        title: 'No announcements',
        description: 'No announcements have been published yet.',
      }}
    />
  );
}


