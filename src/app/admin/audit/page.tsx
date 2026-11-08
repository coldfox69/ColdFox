import { AdminModulePage } from '@/components/admin/AdminModulePage';

export const metadata = {
  title: 'Audit & Security - Admin',
  description: 'Audit log events.',
};

export default function AuditPage() {
  return (
    <AdminModulePage
      module="audit"
      title="Audit & Security"
      description="Platform audit log events."
      columns={[
        { key: 'id', label: 'Audit ID' },
        { key: 'action', label: 'Action' },
        { key: 'entity_type', label: 'Entity Type' },
        { key: 'actor_email', label: 'Actor' },
        { key: 'created_at', label: 'Created' },
      ]}
      emptyState={{
        title: 'No audit events',
        description: 'No audit events have been recorded yet.',
      }}
    />
  );
}


