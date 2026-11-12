import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const AgentWorkspacePage = dynamic(() => import('@/views/app/AgentWorkspacePage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Agent - ColdFox',
  description: 'Give the agent what it needs and let it run.',
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ source?: string; automation?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  return (
    <AgentWorkspacePage
      slug={slug}
      source={query.source === 'automation' ? 'automation' : 'manual'}
      automationId={query.automation ?? null}
    />
  );
}
