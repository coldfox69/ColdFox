import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { getSessionContext } from '@/lib/auth/context';
import { getAgentForWorkspace } from '@/lib/data/app';

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
  const ctx = await getSessionContext();
  const data = ctx?.organization ? await getAgentForWorkspace(slug, ctx.organization.id) : null;
  return (
    <AgentWorkspacePage
      slug={slug}
      source={query.source === 'automation' ? 'automation' : 'manual'}
      automationId={query.automation ?? null}
      initialAgent={data?.agent ?? null}
      initialRuns={data?.runs ?? []}
    />
  );
}
