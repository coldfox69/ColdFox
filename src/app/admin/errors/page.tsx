import { AdminModulePage } from '@/components/admin/AdminModulePage';

export const metadata = {
  title: 'Error Logs - Admin',
  description: 'Platform error logs.',
};

export default function ErrorsPage() {
  return (
    <AdminModulePage
      module="errors"
      title="Error Logs"
      description="Recent platform error logs."
      columns={[
        { key: 'id', label: 'Error ID' },
        { key: 'level', label: 'Level' },
        { key: 'message', label: 'Message' },
        { key: 'created_at', label: 'Created' },
      ]}
      emptyState={{
        title: 'No errors',
        description: 'No error logs found.',
      }}
    />
  );
}


