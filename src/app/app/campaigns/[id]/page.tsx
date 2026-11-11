import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getSessionContext } from '@/lib/auth/context';

const CampaignDetailPage = dynamic(() => import('@/views/app/CampaignDetailPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Campaign - ColdFox',
  description: 'Live status, recipient activity, and campaign controls.',
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx?.organization) notFound();
  const { id } = await params;
  return <CampaignDetailPage campaignId={id} />;
}
