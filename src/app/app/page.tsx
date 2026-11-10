import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { getOverview } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const OverviewPage = dynamic(() => import('@/views/app/OverviewPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Overview - ColdFox',
  description: 'Your outreach at a glance.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const data = ctx?.organization ? await getOverview(ctx.organization.id) : null;
  return <OverviewPage data={data ?? { totals: { totalLeads: 0, activeCampaigns: 0, emailsSent: 0, delivered: 0, replied: 0, bounced: 0, unsubscribed: 0, sendingHealth: 0 }, chartData: [], campaigns: [], mailboxes: [], activity: [], recommendations: [] }} />;
}
