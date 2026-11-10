import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { getOverview } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const OverviewPage = dynamic(() => import('@/views/app/OverviewPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Overview - ColdFox',
  description: 'Your outreach at a glance.',
};

const MODULE_LOADED_AT = Date.now();

export default async function Page() {
  console.log(`[render] page module->render ${Date.now() - MODULE_LOADED_AT}ms uptime=${Math.round(process.uptime() * 1000)}ms`);
  const t0 = Date.now();
  const ctx = await getSessionContext();
  console.log(`[render] page getSessionContext ${Date.now() - t0}ms`);
  const t1 = Date.now();
  const data = ctx?.organization ? await getOverview(ctx.organization.id) : null;
  console.log(`[render] page getOverview ${Date.now() - t1}ms`);
  return <OverviewPage data={data ?? { totals: { totalLeads: 0, activeCampaigns: 0, emailsSent: 0, delivered: 0, replied: 0, bounced: 0, unsubscribed: 0, sendingHealth: 0 }, chartData: [], campaigns: [], mailboxes: [], activity: [], recommendations: [] }} />;
}
