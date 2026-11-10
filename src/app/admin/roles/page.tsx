import { AdminModulePage } from '@/components/admin/AdminModulePage';

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
      rowsKey="admins"
      columns={[
        { key: 'role', label: 'Role' },
        { key: 'user_id', label: 'User ID' },
        { key: 'granted_at', label: 'Granted At' },
      ]}
      emptyState={{
        title: 'No admin roles',
        description: 'No admin roles assigned yet.',
      }}
    />
  );
}


