import type { Metadata } from 'next';
import { after } from 'next/server';
import { getSessionContext } from '@/lib/auth/context';
import { getOverview } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const OverviewPage = dynamic(async () => {
  const t = Date.now();
  const mod = await import('@/views/app/OverviewPage');
  console.log(`[render] dynamic import of OverviewPage took ${Date.now() - t}ms`);
  return mod.default;
});

export const metadata: Metadata = {
  title: 'Overview - ColdFox',
  description: 'Your outreach at a glance.',
};

const MODULE_LOADED_AT = Date.now();

export default async function Page() {
  const renderStart = Date.now();
  console.log(`[render] page module->render ${renderStart - MODULE_LOADED_AT}ms uptime=${Math.round(process.uptime() * 1000)}ms at=${renderStart}`);
  const t0 = Date.now();
  const ctx = await getSessionContext();
  console.log(`[render] page getSessionContext ${Date.now() - t0}ms`);
  const t1 = Date.now();
  const data = ctx?.organization ? await getOverview(ctx.organization.id) : null;
  console.log(`[render] page getOverview ${Date.now() - t1}ms`);
  const pageEnd = Date.now();
  after(() => {
    console.log(`[render] after() fired gap=${Date.now() - pageEnd}ms pageEnd=${pageEnd} now=${Date.now()}`);
  });
  return <OverviewPage data={data ?? { totals: { totalLeads: 0, activeCampaigns: 0, emailsSent: 0, delivered: 0, replied: 0, bounced: 0, unsubscribed: 0, sendingHealth: 0 }, chartData: [], campaigns: [], mailboxes: [], activity: [], recommendations: [] }} />;
}
