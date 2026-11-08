import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { apiFetch } from '@/lib/client/api';
import dynamic from 'next/dynamic';

const CampaignsPage = dynamic(() => import('@/views/app/CampaignsPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Campaigns — ColdFox',
  description: 'Create, schedule, and monitor your outreach campaigns.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const campaigns = ctx?.organization ? await apiFetch<any[]>('/api/campaigns') : [];
  return <CampaignsPage initialCampaigns={campaigns ?? []} />;
}

