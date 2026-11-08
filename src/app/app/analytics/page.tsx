import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { getAnalytics } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const AnalyticsPage = dynamic(() => import('@/views/app/AnalyticsPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Analytics - ColdFox',
  description: 'Campaign delivery and reply analytics.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const data = ctx?.organization ? await getAnalytics(ctx.organization.id) : null;
  return <AnalyticsPage data={data ?? { totals: { totalLeads: 0, activeCampaigns: 0, campaigns: 0, emailsSent: 0, delivered: 0, opened: 0, clicked: 0, replies: 0, bounces: 0, unsubscribes: 0, bounceRate: 0, replyRate: 0, unsubscribeRate: 0, sendingHealth: 0 }, chartData: [], campaigns: [], mailboxes: [], domains: [], recentActivity: [], eventCounts: {} }} />;
}
