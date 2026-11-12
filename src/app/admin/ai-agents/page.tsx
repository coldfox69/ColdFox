import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'AI Agents - Admin',
  description: 'Create, configure and publish the agents users can run.',
};

export default function Page() {
  return <AdminModuleRoute module="ai-agents" />;
}
