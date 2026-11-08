import { AdminModulePage } from '@/components/admin/AdminModulePage';

export const metadata = {
  title: 'AI Usage - Admin',
  description: 'AI credit consumption across organizations.',
};

export default function AiUsagePage() {
  return (
    <AdminModulePage
      module="ai-usage"
      title="AI Usage"
      description="AI generation records across organizations."
      columns={[
        { key: 'id', label: 'Generation ID' },
        { key: 'kind', label: 'Kind' },
        { key: 'model', label: 'Model' },
        { key: 'tokens_in', label: 'Tokens In' },
        { key: 'tokens_out', label: 'Tokens Out' },
        { key: 'created_at', label: 'Created' },
      ]}
      emptyState={{
        title: 'No AI usage',
        description: 'No AI generations have been recorded yet.',
      }}
    />
  );
}


