import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { apiFetch } from '@/lib/client/api';
import dynamic from 'next/dynamic';

const AutomationsPage = dynamic(() => import('@/views/app/AutomationsPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Automations — ColdFox',
  description: 'Follow-up sequences and campaign triggers.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const data = ctx?.organization ? await apiFetch<any>('/api/automations') : { workflows: [], executionCounts: {} };
  return <AutomationsPage data={data ?? { workflows: [], executionCounts: {} }} />;
}

