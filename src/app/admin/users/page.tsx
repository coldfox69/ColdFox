import { AdminModulePage } from '@/components/admin/AdminModulePage';
import { Users } from 'lucide-react';

export const metadata = {
  title: 'Users — Admin',
  description: 'Manage platform users.',
};

export default function UsersPage() {
  return (
    <AdminModulePage
      module="users"
      title="Users"
      description="Platform users and their sign-in activity."
      icon={Users}
      columns={[
        { key: 'id', label: 'User ID' },
        { key: 'email', label: 'Email' },
        { key: 'created_at', label: 'Created' },
        { key: 'last_sign_in_at', label: 'Last Sign In' },
        { key: 'confirmed', label: 'Confirmed' },
      ]}
      emptyState={{
        title: 'No users',
        description: 'No users have signed up yet.',
      }}
    />
  );
}


