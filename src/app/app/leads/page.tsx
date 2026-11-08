import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { getLeads } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const LeadsPage = dynamic(() => import('@/views/app/LeadsPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Leads & CRM - ColdFox',
  description: 'Manage your contacts and import leads.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const leads = ctx?.organization ? await getLeads(ctx.organization.id, 1000) : [];
  return <LeadsPage initialLeads={leads ?? []} />;
}
