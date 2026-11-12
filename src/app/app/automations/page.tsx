import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { getAutomations, getPublishedAgents } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const AutomationsPage = dynamic(() => import('@/views/app/AutomationsPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Automations - ColdFox',
  description: 'Follow-up sequences, campaign triggers and AI agent tasks.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const data = ctx?.organization ? await getAutomations(ctx.organization.id) : { workflows: [], executionCounts: {} };
  const agents = await getPublishedAgents();
  return <AutomationsPage data={data ?? { workflows: [], executionCounts: {} }} agents={agents} />;
}
