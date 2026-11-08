import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { getLeadDetail, getLeads } from '@/lib/data/app';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';

const LeadProfilePage = dynamic(() => import('@/views/app/LeadProfilePage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Lead Details - ColdFox',
  description: 'View lead profile and conversation history.',
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!ctx?.organization) redirect('/login');
  const [detail, coworkers] = await Promise.all([
    getLeadDetail(ctx.organization.id, id),
    getLeads(ctx.organization.id, 50),
  ]);
  if (!detail) redirect('/app/leads');
  return <LeadProfilePage detail={detail} coworkers={coworkers ?? []} />;
}
