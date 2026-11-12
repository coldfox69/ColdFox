import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { getPublishedAgents } from '@/lib/data/app';

const AgentsPage = dynamic(() => import('@/views/app/AgentsPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'AI Agents - ColdFox',
  description: 'Run specialised agents that find prospects and hand them to your campaigns.',
};

export default async function Page() {
  const agents = await getPublishedAgents();
  return <AgentsPage agents={agents} />;
}
