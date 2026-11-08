import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { apiFetch } from '@/lib/client/api';
import dynamic from 'next/dynamic';

const OverviewPage = dynamic(() => import('@/views/app/OverviewPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Overview — ColdFox',
  description: 'Your outreach at a glance.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const data = ctx?.organization ? await apiFetch<any>('/api/overview') : null;
  return <OverviewPage data={data ?? { totals: {}, chartData: [], campaigns: [], mailboxes: [], activity: [], recommendations: [] }} />;
}

