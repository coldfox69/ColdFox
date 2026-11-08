import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { apiFetch } from '@/lib/client/api';
import dynamic from 'next/dynamic';

const AnalyticsPage = dynamic(() => import('@/views/app/AnalyticsPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Analytics - ColdFox',
  description: 'Campaign delivery and reply analytics.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const data = ctx?.organization ? await apiFetch<any>('/api/analytics') : null;
  return <AnalyticsPage data={data ?? { totals: {}, chartData: [], campaigns: [], mailboxes: [], domains: [], recentActivity: [], eventCounts: {} }} />;
}

