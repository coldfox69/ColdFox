import { AdminModulePage } from '@/components/admin/AdminModulePage';
import { Shield } from 'lucide-react';

export const metadata = {
  title: 'Admin Roles - Admin',
  description: 'Manage platform admin roles.',
};

export default function RolesPage() {
  return (
    <AdminModulePage
      module="roles"
      title="Admin Roles"
      description="Platform admin role assignments."
      icon={Shield}
      columns={[
        { key: 'key', label: 'Role Key' },
        { key: 'user_id', label: 'User ID' },
        { key: 'role', label: 'Role' },
        { key: 'granted_at', label: 'Granted At' },
      ]}
      emptyState={{
        title: 'No admin roles',
        description: 'No admin roles assigned yet.',
      }}
    />
  );
}


