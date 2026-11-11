import { AdminModuleRoute } from '@/components/admin/AdminModuleRoute';

export const metadata = {
  title: 'AI usage - Admin',
  description: 'AI generation records, tokens and cost.',
};

export default function Page() {
  return <AdminModuleRoute module="ai-usage" />;
}
