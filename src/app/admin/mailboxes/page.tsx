import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'Mailboxes - Admin',
  description: 'Sending identities, limits and health. Credentials are never shown.',
};

export default function Page() {
  return <AdminModuleRoute module="mailboxes" />;
}
