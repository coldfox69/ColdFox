import { AgentEditorPage } from '@/views/admin/AgentEditorPage';

export const metadata = {
  title: 'Edit agent - Admin',
  description: 'Configure the agent, its input fields and its API.',
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentEditorPage agentId={id} />;
}
